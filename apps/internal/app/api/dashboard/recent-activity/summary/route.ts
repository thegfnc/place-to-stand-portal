import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText } from 'ai'
import { and, count, eq, gte, inArray, isNull } from 'drizzle-orm'

import type { ActivityLogWithActor } from '@/lib/activity/types'
import type { Json } from '@/lib/types/json'
import { fetchActivityLogsSince } from '@/lib/activity/queries'
import {
  loadActivityOverviewCache,
  upsertActivityOverviewCache,
} from '@/lib/activity/overview-cache'
import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, leads, projects, tasks } from '@/lib/db/schema'

const VALID_TIMEFRAMES = [1, 7, 14, 28] as const
const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_LOG_LINES_IN_PROMPT = 200
// Gateway model id + reasoning level for the highlight. The summary is a few
// thousand input tokens and a short paragraph out, so a Flash-tier model at
// low thinking effort is plenty; bump here when a newer cheap model lands.
// The id is echoed in the `x-activity-overview-model` response header so the
// widget footer can show which model is in use.
const ACTIVITY_SUMMARY_MODEL = 'zai/glm-5.3-flash'
const ACTIVITY_SUMMARY_REASONING = 'low' as const
const HIGHLIGHT_CHARACTER_LIMIT = 1200

type ValidTimeframe = (typeof VALID_TIMEFRAMES)[number]

type CacheStatus = 'hit' | 'miss'

type CacheHeaders = {
  status: CacheStatus
  cachedAt: string
  expiresAt: string
}

type ActivityMetrics = {
  tasksDone: number
  newLeads: number
  activeProjects: number
  blockedTasks: number
}

type ActivityOverviewResponse = {
  metrics: ActivityMetrics
  highlight: string
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

  // Defense-in-depth: the internal portal is admin-only, and the briefing is
  // built from UNSCOPED activity logs (fetchActivityLogsSince) plus global
  // lead/task metrics — internal operations data.
  assertAdmin(user)

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
      const cachedResponse = parseCachedResponse(cache.summary)
      return jsonResponse(cachedResponse, {
        status: 'hit',
        cachedAt: cache.cached_at,
        expiresAt: cache.expires_at,
      })
    }

    const since = new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000)
    const logs = await fetchActivityLogsSince(user, {
      since: since.toISOString(),
      limit: MAX_LOG_LINES_IN_PROMPT,
    })

    const expiresAtIso = new Date(now.getTime() + ONE_HOUR_MS).toISOString()

    const [metrics, context] = await Promise.all([
      computeMetrics(logs, since),
      buildActivityContext(logs),
    ])

    if (!logs.length) {
      const response: ActivityOverviewResponse = {
        metrics,
        highlight: buildNoActivityHighlight(timeframeDays as ValidTimeframe),
      }

      await upsertActivityOverviewCache({
        userId: user.id,
        timeframeDays,
        summary: response as unknown as Json,
        cachedAt: nowIso,
        expiresAt: expiresAtIso,
      })

      return jsonResponse(response, {
        status: 'miss',
        cachedAt: nowIso,
        expiresAt: expiresAtIso,
      })
    }

    let highlight = ''
    try {
      const result = await generateText({
        model: ACTIVITY_SUMMARY_MODEL,
        reasoning: ACTIVITY_SUMMARY_REASONING,
        system: buildSystemPrompt(timeframeDays as ValidTimeframe),
        prompt: buildUserPrompt({
          timeframeDays: timeframeDays as ValidTimeframe,
          logs,
          now,
          context,
          metrics,
        }),
      })
      highlight = result.text.trim()
    } catch (aiError) {
      console.error('Failed to generate activity highlight', aiError)
    }

    if (!highlight) {
      highlight = buildFallbackHighlight(logs, timeframeDays, metrics)
    }

    highlight = enforceHighlightCharacterLimit(highlight, HIGHLIGHT_CHARACTER_LIMIT)

    const response: ActivityOverviewResponse = {
      metrics,
      highlight,
    }

    try {
      await upsertActivityOverviewCache({
        userId: user.id,
        timeframeDays,
        summary: response as unknown as Json,
        cachedAt: new Date().toISOString(),
        expiresAt: expiresAtIso,
      })
    } catch (cacheError) {
      console.error('Failed to cache activity overview summary', cacheError)
    }

    return jsonResponse(response, {
      status: 'miss',
      cachedAt: nowIso,
      expiresAt: expiresAtIso,
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
function jsonResponse(
  data: ActivityOverviewResponse,
  headers: CacheHeaders
): Response {
  return NextResponse.json(data, {
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
    'x-activity-overview-cache': status,
    'x-activity-overview-cached-at': cachedAt,
    'x-activity-overview-expires-at': expiresAt,
    'x-activity-overview-model': ACTIVITY_SUMMARY_MODEL,
  }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseCachedResponse(summary: Json): ActivityOverviewResponse {
  // Rows written before the column became jsonb hold a JSON string; newer
  // rows hold the object directly.
  const parsed: unknown =
    typeof summary === 'string' ? safeParse(summary) : summary
  if (
    parsed &&
    typeof parsed === 'object' &&
    'metrics' in parsed &&
    'highlight' in parsed
  ) {
    return parsed as ActivityOverviewResponse
  }
  return {
    metrics: { tasksDone: 0, newLeads: 0, activeProjects: 0, blockedTasks: 0 },
    highlight: 'No recent activity to report.',
  }
}

async function computeMetrics(
  logs: ActivityLogWithActor[],
  since: Date
): Promise<ActivityMetrics> {
  const activeProjects = countActiveProjects(logs)

  const [tasksDone, newLeads, blockedTasks] = await Promise.all([
    countTasksDone(since),
    countNewLeads(since),
    countBlockedTasks(),
  ])

  return {
    tasksDone,
    newLeads,
    activeProjects,
    blockedTasks,
  }
}

async function countTasksDone(since: Date): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        gte(tasks.acceptedAt, since.toISOString())
      )
    )

  return result[0]?.count ?? 0
}

/**
 * Page views were logged as activity until Sep 2026; historical rows still
 * carry `*_VIEWED` verbs and must not count as project activity or feed the
 * prompt.
 */
function isViewEvent(log: ActivityLogWithActor): boolean {
  return log.verb.endsWith('_VIEWED') && log.target_type !== 'INVOICE'
}

function countActiveProjects(logs: ActivityLogWithActor[]): number {
  const projectIds = new Set<string>()
  for (const log of logs) {
    if (log.target_project_id && !isViewEvent(log)) {
      projectIds.add(log.target_project_id)
    }
  }
  return projectIds.size
}

async function countNewLeads(since: Date): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(leads)
    .where(and(isNull(leads.deletedAt), gte(leads.createdAt, since.toISOString())))

  return result[0]?.count ?? 0
}

async function countBlockedTasks(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.status, 'BLOCKED')))

  return result[0]?.count ?? 0
}

function buildSystemPrompt(timeframe: ValidTimeframe): string {
  return [
    "You're a chief of staff writing a brief team activity briefing.",
    `Based on the last ${timeframe} day${timeframe === 1 ? '' : 's'} of activity, write a summary broken down by team member.`,
    '',
    'Format rules:',
    '- The entire output is bold headings with bullet points under them. Nothing else.',
    '- Use **Name** as a bold heading for each team member who had activity.',
    '- Under each name, use 1-3 bullet points (using -) summarizing their key contributions.',
    '- Each bullet should be a concise, specific sentence mentioning project names or clients when available.',
    '- Focus on what matters: progress made, deals or leads, blockers, or notable momentum.',
    '- Write conversationally and casually.',
    '- If a team member only had minor activity (e.g., a single comment), you can combine them into an "Others" section.',
    '- Any closing section (e.g. **Heads up** or **Good news**) follows the same shape: a bold heading on its own line, then bullets. Never write a paragraph or a bold label followed by prose on the same line.',
    '- No H1/H2 headers (#), no code blocks, no free-standing sentences — just bold headings and bullets.',
    '',
    'Example:',
    '**Jason**',
    '- Knocked out 5 tasks on the Acme dashboard redesign, moving it closer to launch.',
    '- Logged 3.5 hours on the WidgetCo API integration.',
    '',
    '**Sarah**',
    '- Closed 2 new leads from the website — worth following up on.',
    '- Flagged a blocker on the API integration waiting on client feedback.',
    '',
    '**Heads up**',
    '- 2 tasks are blocked on client feedback — nudge Acme this week so the launch date holds.',
  ].join('\n')
}

function buildUserPrompt({
  timeframeDays,
  logs,
  now,
  context,
  metrics,
}: {
  timeframeDays: ValidTimeframe
  logs: ActivityLogWithActor[]
  now: Date
  context: ActivityContext
  metrics: ActivityMetrics
}): string {
  const timeframeLabel = timeframeDaysLabel(timeframeDays)

  // Group logs by actor for per-member breakdown
  const logsByActor = new Map<string, string[]>()
  for (const log of logs.filter(log => !isViewEvent(log)).slice(-50)) {
    const actorName = (
      log.actor?.full_name?.trim() || log.actor?.email || 'System'
    ).replace(/\s+/g, ' ')
    const existing = logsByActor.get(actorName) ?? []
    existing.push(formatActivityLog(log, context))
    logsByActor.set(actorName, existing)
  }

  const groupedSection = Array.from(logsByActor.entries())
    .map(([actor, entries]) => `=== ${actor} ===\n${entries.join('\n')}`)
    .join('\n\n')

  return [
    `Today is ${now.toISOString()}. Write a team activity summary for ${timeframeLabel}.`,
    '',
    'Current metrics:',
    `- Tasks accepted: ${metrics.tasksDone}`,
    `- New leads: ${metrics.newLeads}`,
    `- Active projects: ${metrics.activeProjects}`,
    `- Blocked tasks: ${metrics.blockedTasks}`,
    '',
    'Recent activity grouped by team member:',
    groupedSection,
    '',
    'Write a summary broken down by team member using **Name** headings and bullet points. Keep it concise and actionable. Every line must be either a bold heading or a bullet — no paragraphs.',
  ].join('\n')
}

function buildNoActivityHighlight(timeframeDays: ValidTimeframe): string {
  const label = timeframeDaysLabel(timeframeDays)
  return `No activity logged during the ${label}. Things are quiet on the operations front—a good time to plan ahead or check in with the team.`
}

function buildFallbackHighlight(
  logs: ActivityLogWithActor[],
  timeframeDays: number,
  metrics: ActivityMetrics
): string {
  const dayLabel = timeframeDays === 1 ? 'day' : 'days'
  const bullets: string[] = []

  if (metrics.tasksDone > 0) {
    const taskWord = metrics.tasksDone === 1 ? 'task was' : 'tasks were'
    bullets.push(`${metrics.tasksDone} ${taskWord} accepted over the past ${timeframeDays} ${dayLabel}.`)
  }

  if (metrics.newLeads > 0) {
    const leadWord = metrics.newLeads === 1 ? 'lead' : 'leads'
    bullets.push(`${metrics.newLeads} new ${leadWord} came in — worth a look.`)
  }

  if (metrics.blockedTasks > 0) {
    const blockedWord = metrics.blockedTasks === 1 ? 'task is' : 'tasks are'
    bullets.push(`${metrics.blockedTasks} ${blockedWord} currently blocked and may need attention.`)
  }

  if (bullets.length === 0) {
    return `${logs.length} updates logged over the past ${timeframeDays} ${dayLabel}. Activity is ticking along steadily.`
  }

  return '**Team Summary**\n' + bullets.map(b => `- ${b}`).join('\n')
}

function enforceHighlightCharacterLimit(text: string, limit: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= limit) {
    return trimmed
  }
  return trimmed.slice(0, limit - 1).trimEnd() + '…'
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
  CONTACT: 'contact updates',
  LEAD: 'lead activity',
  INVOICE: 'invoicing',
  SUBMISSION: 'website submissions',
  MONTHLY_CLOSE: 'monthly close',
  CLIENT_UPDATE: 'client updates sent',
  PLAN: 'planning',
}

const DEFAULT_PROJECT_LABEL = 'General'
const DEFAULT_CLIENT_LABEL = 'General'
const COMPANY_GENERAL_CLIENT_LABEL = 'Place To Stand'

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

/**
 * Resolves project/client display names for the AI prompt. No per-user
 * filtering: this route is admin-only (assertAdmin above), so the caller may
 * see every referenced project and client.
 */
async function buildActivityContext(
  logs: ActivityLogWithActor[]
): Promise<ActivityContext> {
  const allowedProjectIds = dedupeIds(logs.map(log => log.target_project_id))
  const allowedClientIds = dedupeIds(logs.map(log => log.target_client_id))

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
