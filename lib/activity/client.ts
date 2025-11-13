'use client'

import type { Json } from '@/lib/types/json'

import type { ActivityEvent, ActivityTargetType, ActivityVerb } from './types'

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const mergeMetadata = (
  base: Json | undefined,
  extra: Json | undefined
): Json | null => {
  if (!base && !extra) {
    return null
  }

  if (!base) {
    return JSON.parse(JSON.stringify(extra)) as Json
  }

  if (!extra) {
    return JSON.parse(JSON.stringify(base)) as Json
  }

  if (isPlainObject(base) && isPlainObject(extra)) {
    return JSON.parse(
      JSON.stringify({
        ...(base as Record<string, unknown>),
        ...(extra as Record<string, unknown>),
      })
    ) as Json
  }

  return JSON.parse(JSON.stringify(extra)) as Json
}

type ClientActivityContext = {
  actorId: string
  verb?: ActivityVerb
  summary?: string
  targetType: ActivityTargetType | string
  targetId?: string | null
  targetClientId?: string | null
  targetProjectId?: string | null
  contextRoute?: string | null
  metadata?: Json
}

export async function logClientActivity(
  event: ActivityEvent,
  context: ClientActivityContext
) {
  const mergedMetadata = mergeMetadata(event.metadata, context.metadata)

  const body: Record<string, unknown> = {
    actorId: context.actorId,
    verb: context.verb ?? event.verb,
    summary: context.summary ?? event.summary,
    targetType: context.targetType,
    targetId: context.targetId ?? null,
    targetClientId: context.targetClientId ?? null,
    targetProjectId: context.targetProjectId ?? null,
    contextRoute: context.contextRoute ?? null,
  }

  if (mergedMetadata !== null) {
    body.metadata = mergedMetadata
  }

  try {
    const response = await fetch('/api/activity/log', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error('Failed to log client-side activity', {
        status: response.status,
        verb: body.verb,
        targetType: body.targetType,
        targetId: body.targetId ?? null,
      })
    }
  } catch (error) {
    console.error('Failed to log client-side activity', {
      error,
      verb: body.verb,
      targetType: body.targetType,
      targetId: body.targetId ?? null,
    })
  }
}
