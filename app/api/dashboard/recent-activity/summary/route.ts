import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamText } from 'ai'
import { and, inArray, isNull } from 'drizzle-orm'

import type { ActivityLogWithActor } from '@/lib/activity/types'
import type { Json } from '@/lib/types/json'
import { fetchActivityLogsSince } from '@/lib/activity/queries'
import {
  loadActivityOverviewCache,
  upsertActivityOverviewCache,
} from '@/lib/activity/overview-cache'
import { getCurrentUser, type AppUser } from '@/lib/auth/session'
import {
  listAccessibleClientIds,
  listAccessibleProjectIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'

const VALID_TIMEFRAMES = [1, 7, 14, 28] as const
const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_LOG_LINES_IN_PROMPT = 200

type ValidTimeframe = (typeof VALID_TIMEFRAMES)[number]

type CacheStatus = 'hit' | 'miss'

type CacheHeaders = {
  status: CacheStatus
  cachedAt: string
  expiresAt: string
}

const requestSchema = z.object({
  timeframeDays: z.number().int(),
  forceRefresh: z.boolean().optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let timeframeDays: number
  let forceRefresh = false

  try {
    const payload = await request.json()
    const parsed = requestSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload.' },
        { status: 400 }
      )
    }

    timeframeDays = parsed.data.timeframeDays
    forceRefresh = parsed.data.forceRefresh ?? false
  } catch (error) {
    console.error('Invalid request body for recent activity summary', error)
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    )
  }

  if (!VALID_TIMEFRAMES.includes(timeframeDays as ValidTimeframe)) {
    return NextResponse.json(
      { error: 'Unsupported timeframe requested.' },
      { status: 400 }
    )
  }

  const now = new Date()
  const nowIso = now.toISOString()

  try {
    const cache = await loadActivityOverviewCache({
      userId: user.id,
      timeframeDays,
    })

    if (
      !forceRefresh &&
      cache &&
      new Date(cache.expires_at).getTime() > now.getTime()
    ) {
      return streamFromString(cache.summary, {
        status: 'hit',
        cachedAt: cache.cached_at,
        expiresAt: cache.expires_at,
      })
    }

    const since = new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000)
    const logs = await fetchActivityLogsSince({
      since: since.toISOString(),
      limit: MAX_LOG_LINES_IN_PROMPT,
    })

    if (!logs.length) {
      const summary = buildNoActivitySummary(timeframeDays as ValidTimeframe)
      const expiresAtIso = new Date(now.getTime() + ONE_HOUR_MS).toISOString()

      await upsertActivityOverviewCache({
        userId: user.id,
        timeframeDays,
        summary,
        cachedAt: nowIso,
        expiresAt: expiresAtIso,
      })

      return streamFromString(summary, {
        status: 'miss',
        cachedAt: nowIso,
        expiresAt: expiresAtIso,
      })
    }

    const context = await buildActivityContext(user, logs)
    const expiresAtIso = new Date(now.getTime() + ONE_HOUR_MS).toISOString()

    const result = await streamText({
      model: 'google/gemini-2.5-flash-lite',
      system: buildSystemPrompt(timeframeDays as ValidTimeframe),
      prompt: buildUserPrompt({
        timeframeDays: timeframeDays as ValidTimeframe,
        logs,
        now,
        context,
      }),
      onFinish: async ({ text }) => {
        const completion = (text ?? '').trim()
        const summaryToStore =
          completion || buildFallbackSummary(logs, timeframeDays, context)

        try {
          await upsertActivityOverviewCache({
            userId: user.id,
            timeframeDays,
            summary: summaryToStore,
            cachedAt: new Date().toISOString(),
            expiresAt: expiresAtIso,
          })
        } catch (cacheError) {
          console.error('Failed to cache activity overview summary', cacheError)
        }
      },
    })

    return result.toTextStreamResponse({
      headers: buildCacheHeaders({
        status: 'miss',
        cachedAt: nowIso,
        expiresAt: expiresAtIso,
      }),
    })
  } catch (error) {
    console.error('Invalid request body for recent activity summary', error)
    console.error('Failed to resolve recent activity overview', error)
    return NextResponse.json(
      { error: 'Unable to summarize recent activity.' },
      { status: 500 }
    )
  }
}
function streamFromString(text: string, headers: CacheHeaders) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: buildCacheHeaders(headers),
  })
}

function buildCacheHeaders({
  status,
  cachedAt,
  expiresAt,
}: CacheHeaders): HeadersInit {
  return {
    'cache-control': 'no-store',
    'content-type': 'text/plain; charset=utf-8',
    'x-activity-overview-cache': status,
    'x-activity-overview-cached-at': cachedAt,
    'x-activity-overview-expires-at': expiresAt,
  }
}

function buildSystemPrompt(timeframe: ValidTimeframe): string {
  return [
    'You are the Place to Stand chief of staff drafting a high-signal executive briefing for an extremely busy CEO.',
    `Summarize the most important activity from the last ${timeframe} days using concise markdown sections. Keep it short and to the point.`,
    'Group updates by client and project using level-three markdown headings in the exact format "### {Client Name} - {Project Name}".',
    'Always include a "### Place To Stand - General" section first when there are organization-wide updates or uncategorized activity.',
    'If only one of client/project is known, label the missing dimension as "General". When nothing fits, use the heading "### Place To Stand - General".',
    'Under each heading include up to three bullet points that capture the latest movement, progress, blockers, or decisions. Skip filler, avoid repeating the same idea, and never speculate.',
    'Do not fabricate project or client names—only reference what the activity feed supports.',
    'If there is no activity, output a single heading "### Place To Stand - General" followed by the bullet "- No recent updates logged."',
  ].join(' ')
}

function buildUserPrompt({
  timeframeDays,
  logs,
  now,
  context,
}: {
  timeframeDays: ValidTimeframe
  logs: ActivityLogWithActor[]
  now: Date
  context: ActivityContext
}): string {
  const timeframeLabel = timeframeDaysLabel(timeframeDays)
  const formattedLogs = logs
    .map(log => formatActivityLog(log, context))
    .join('\n')

  return [
    `Today is ${now.toISOString()}. Summarize company activity for ${timeframeLabel}.`,
    'Each line below is a JSON object describing a recorded activity. Treat them as factual notes.',
    'Group updates so that each heading captures a single client/project pair and is formatted "### {Client Name} - {Project Name}".',
    'Place any uncategorized or cross-company updates in "### Place To Stand - General" and list that heading first when it exists.',
    'If only one dimension is known, label the missing half as "General". When nothing fits, place the update under "Place To Stand - General".',
    'Combine multiple logs for the same project into a single heading that reflects the latest movement.',
    'Respond using markdown with the required headings and bullet lists only—no additional prose or sections.',
    '',
    'Activity log (JSON lines):',
    formattedLogs,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildNoActivitySummary(timeframeDays: ValidTimeframe): string {
  return [
    `### ${COMPANY_GENERAL_HEADING}`,
    `- No recent updates logged during the ${timeframeDaysLabel(timeframeDays)}.`,
    '- Operations remain steady while we await new activity.',
  ].join('\n')
}

function buildFallbackSummary(
  logs: ActivityLogWithActor[],
  timeframeDays: number,
  context: ActivityContext
): string {
  const grouped = groupLogsByProject(logs, context)

  if (!grouped.length) {
    return [
      `### ${COMPANY_GENERAL_HEADING}`,
      `- Logged ${logs.length} updates over the ${timeframeDaysLabel(timeframeDays as ValidTimeframe)}.`,
    ].join('\n')
  }

  const sections: string[] = []

  for (const group of grouped) {
    sections.push(`### ${group.heading}`)
    sections.push(...group.bullets)
  }

  return sections.join('\n')
}

function timeframeDaysLabel(timeframe: ValidTimeframe): string {
  switch (timeframe) {
    case 1:
      return 'last 1 day'
    case 7:
      return 'last 7 days'
    case 14:
      return 'last 14 days'
    case 28:
      return 'last 28 days'
    default:
      return `${timeframe} days`
  }
}

type ActivityContext = {
  projects: Record<
    string,
    {
      id: string
      name: string
      clientId: string | null
    }
  >
  clients: Record<
    string,
    {
      id: string
      name: string
    }
  >
}

const TARGET_LABELS: Record<string, string> = {
  TASK: 'task work',
  PROJECT: 'project updates',
  CLIENT: 'client updates',
  COMMENT: 'task comments',
  TIME_LOG: 'time logs',
  HOUR_BLOCK: 'hour blocks',
  USER: 'team members',
  SETTINGS: 'settings changes',
  GENERAL: 'general operations',
}

const DEFAULT_PROJECT_LABEL = 'General'
const DEFAULT_CLIENT_LABEL = 'General'
const COMPANY_GENERAL_CLIENT_LABEL = 'Place To Stand'
const COMPANY_GENERAL_HEADING = `${COMPANY_GENERAL_CLIENT_LABEL} - ${DEFAULT_PROJECT_LABEL}`

function formatActivityLog(
  log: ActivityLogWithActor,
  context: ActivityContext
): string {
  const { project, client } = resolveProjectClientLabels(log, context)
  const timestamp = new Date(log.created_at)
  const formattedTimestamp = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(timestamp)

  const actorName = (
    log.actor?.full_name?.trim() ||
    log.actor?.email ||
    'System'
  ).replace(/\s+/g, ' ')

  const targetLabel =
    TARGET_LABELS[log.target_type] || log.target_type || 'activity'
  const summary = log.summary.trim()
  const verb = log.verb.replaceAll('_', ' ').toLowerCase()
  const record: Record<string, unknown> = {
    timestamp: formattedTimestamp,
    actor: actorName,
    project,
    client,
    projectId: log.target_project_id,
    clientId: log.target_client_id,
    targetType: log.target_type,
    targetLabel,
    verb,
    summary,
  }

  if (log.metadata && typeof log.metadata === 'object') {
    record.metadata = log.metadata
  }

  return JSON.stringify(record)
}

async function buildActivityContext(
  user: AppUser,
  logs: ActivityLogWithActor[]
): Promise<ActivityContext> {
  const projectIds = dedupeIds(logs.map(log => log.target_project_id))
  const clientIds = dedupeIds(logs.map(log => log.target_client_id))

  const [allowedProjectIds, allowedClientIds] = await Promise.all([
    resolveAllowedProjects(user, projectIds),
    resolveAllowedClients(user, clientIds),
  ])

  const [projectRows, clientRows] = await Promise.all([
    allowedProjectIds.length
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            clientId: projects.clientId,
          })
          .from(projects)
          .where(
            and(
              inArray(projects.id, allowedProjectIds),
              isNull(projects.deletedAt)
            )
          )
      : Promise.resolve([]),
    allowedClientIds.length
      ? db
          .select({
            id: clients.id,
            name: clients.name,
          })
          .from(clients)
          .where(
            and(
              inArray(clients.id, allowedClientIds),
              isNull(clients.deletedAt)
            )
          )
      : Promise.resolve([]),
  ])

  const projectDirectory = projectRows.reduce<ActivityContext['projects']>(
    (acc, row) => {
      acc[row.id] = {
        id: row.id,
        name: row.name?.trim() || 'Unnamed Project',
        clientId: row.clientId,
      }
      return acc
    },
    {}
  )

  const clientDirectory = clientRows.reduce<ActivityContext['clients']>(
    (acc, row) => {
      acc[row.id] = {
        id: row.id,
        name: row.name?.trim() || 'Unnamed Client',
      }
      return acc
    },
    {}
  )

  return {
    projects: projectDirectory,
    clients: clientDirectory,
  }
}

function dedupeIds(values: Array<string | null>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  )
}

async function resolveAllowedProjects(
  user: AppUser,
  projectIds: string[]
): Promise<string[]> {
  if (!projectIds.length) {
    return []
  }

  if (user.role === 'ADMIN') {
    return projectIds
  }

  const accessible = await listAccessibleProjectIds(user)
  const accessibleSet = new Set(accessible)

  return projectIds.filter(id => accessibleSet.has(id))
}

async function resolveAllowedClients(
  user: AppUser,
  clientIds: string[]
): Promise<string[]> {
  if (!clientIds.length) {
    return []
  }

  if (user.role === 'ADMIN') {
    return clientIds
  }

  const accessible = await listAccessibleClientIds(user)
  const accessibleSet = new Set(accessible)

  return clientIds.filter(id => accessibleSet.has(id))
}

const MAX_FALLBACK_PROJECTS = 6
const MAX_FALLBACK_BULLETS_PER_PROJECT = 3

function groupLogsByProject(
  logs: ActivityLogWithActor[],
  context: ActivityContext
) {
  if (!logs.length) {
    return []
  }

  const orderedLogs = [...logs].reverse()
  const groups = new Map<
    string,
    { heading: string; bullets: string[]; order: number }
  >()
  let orderCounter = 0

  for (const log of orderedLogs) {
    const { project, client } = resolveProjectClientLabels(log, context)
    const heading = buildHeading(client, project)

    let group = groups.get(heading)

    if (!group) {
      if (groups.size >= MAX_FALLBACK_PROJECTS) {
        continue
      }

      group = { heading, bullets: [], order: orderCounter++ }
      groups.set(heading, group)
    }

    if (group.bullets.length >= MAX_FALLBACK_BULLETS_PER_PROJECT) {
      continue
    }

    const summary = log.summary.trim()

    if (summary) {
      group.bullets.push(`- ${summary}`)
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aIsGeneral = a.heading === COMPANY_GENERAL_HEADING
    const bIsGeneral = b.heading === COMPANY_GENERAL_HEADING

    if (aIsGeneral && !bIsGeneral) {
      return -1
    }

    if (!aIsGeneral && bIsGeneral) {
      return 1
    }

    return a.order - b.order
  })
}

function resolveProjectClientLabels(
  log: ActivityLogWithActor,
  context: ActivityContext
): { project: string; client: string } {
  const projectFromContext = log.target_project_id
    ? (context.projects[log.target_project_id] ?? null)
    : null

  const clientFromProject =
    projectFromContext?.clientId && context.clients[projectFromContext.clientId]
      ? context.clients[projectFromContext.clientId]
      : null

  const clientFromContext = log.target_client_id
    ? (context.clients[log.target_client_id] ?? null)
    : null

  const projectName = selectFirstNonEmpty(
    [
      projectFromContext?.name,
      readMetadataString(log.metadata, ['project', 'name']),
      readMetadataString(log.metadata, ['task', 'projectName']),
      readMetadataString(log.metadata, ['projectName']),
    ],
    DEFAULT_PROJECT_LABEL
  )

  let clientName = selectFirstNonEmpty(
    [
      clientFromProject?.name,
      clientFromContext?.name,
      readMetadataString(log.metadata, ['client', 'name']),
      readMetadataString(log.metadata, ['clientName']),
    ],
    DEFAULT_CLIENT_LABEL
  )

  if (
    clientName === DEFAULT_CLIENT_LABEL &&
    projectName === DEFAULT_PROJECT_LABEL
  ) {
    clientName = COMPANY_GENERAL_CLIENT_LABEL
  }

  return { project: projectName, client: clientName }
}

function buildHeading(client: string, project: string): string {
  return `${client} - ${project}`
}

function selectFirstNonEmpty(
  values: Array<string | null | undefined>,
  fallback: string
): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length) {
        return trimmed
      }
    }
  }

  return fallback
}

function readMetadataString(
  source: Json | null | undefined,
  path: string[]
): string | null {
  if (!source) {
    return null
  }

  let current: Json | null | undefined = source

  for (const segment of path) {
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      segment in current
    ) {
      current = (current as Record<string, Json | undefined>)[segment]
    } else {
      return null
    }
  }

  return typeof current === 'string' ? current : null
}
