import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamText } from 'ai'

import type { ActivityLogWithActor } from '@/lib/activity/types'
import { fetchActivityLogsSince } from '@/lib/activity/queries'
import {
  loadActivityOverviewCache,
  upsertActivityOverviewCache,
} from '@/lib/activity/overview-cache'
import { getCurrentUser } from '@/lib/auth/session'

const VALID_TIMEFRAMES = [7, 14, 28] as const
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

    const expiresAtIso = new Date(now.getTime() + ONE_HOUR_MS).toISOString()

    const result = await streamText({
      model: 'google/gemini-2.5-flash-lite',
      system: buildSystemPrompt(timeframeDays as ValidTimeframe),
      prompt: buildUserPrompt({
        timeframeDays: timeframeDays as ValidTimeframe,
        logs,
        now,
      }),
      onFinish: async ({ text }) => {
        const completion = (text ?? '').trim()
        const summaryToStore =
          completion || buildFallbackSummary(logs, timeframeDays)

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
    'Output exactly three level-three headings named "### Momentum", "### Risks", and "### Next", each followed by a bullet list.',
    'Use plain language, include clients or projects when relevant, avoid fluff, and never fabricate details.',
    'If there are no risks or next steps, supply a single bullet that states "None noted" for that section.',
  ].join(' ')
}

function buildUserPrompt({
  timeframeDays,
  logs,
  now,
}: {
  timeframeDays: ValidTimeframe
  logs: ActivityLogWithActor[]
  now: Date
}): string {
  const timeframeLabel = timeframeDaysLabel(timeframeDays)
  const formattedLogs = logs.map(formatActivityLog).join('\n')

  return [
    `Today is ${now.toISOString()}. Summarize company activity for ${timeframeLabel}.`,
    'Each line below represents a recorded activity. Treat them as factual notes.',
    'Identify the biggest wins, emerging risks, and commitments leadership should track.',
    'Respond using markdown with the required headings and bullet lists only—no additional prose or sections.',
    '',
    'Activity log:',
    formattedLogs,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildNoActivitySummary(timeframeDays: ValidTimeframe): string {
  return [
    '### Momentum',
    `- No activity logged in the ${timeframeDaysLabel(timeframeDays)}; operations remained stable.`,
    '### Risks',
    '- None noted',
    '### Next',
    '- Maintain current cadence and monitor for new updates.',
  ].join('\n')
}

function buildFallbackSummary(
  logs: ActivityLogWithActor[],
  timeframeDays: number
): string {
  const highlights = logs
    .slice(-3)
    .map(log => log.summary.trim())
    .filter(Boolean)
  const highlightText = highlights.length
    ? highlights.map(item => `- ${item}`).join('\n')
    : '- No standout highlights were captured.'

  return [
    '### Momentum',
    `- Logged ${logs.length} updates over the ${timeframeDaysLabel(timeframeDays as ValidTimeframe)}.`,
    highlightText,
    '### Risks',
    '- No additional context captured in the raw activity feed.',
    '### Next',
    '- Review detailed logs to prioritize any follow-up needed.',
  ].join('\n')
}

function timeframeDaysLabel(timeframe: ValidTimeframe): string {
  switch (timeframe) {
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

function formatActivityLog(log: ActivityLogWithActor): string {
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

  return `${formattedTimestamp} — ${actorName} (${targetLabel}; ${verb}): ${summary}`
}
