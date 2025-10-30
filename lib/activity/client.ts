'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Json } from '@/supabase/types/database'

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
  const supabase = getSupabaseBrowserClient()
  const mergedMetadata = mergeMetadata(event.metadata, context.metadata)

  const { error } = await supabase.rpc('log_activity', {
    p_actor_id: context.actorId,
    p_actor_role: null,
    p_verb: context.verb ?? event.verb,
    p_summary: context.summary ?? event.summary,
    p_target_type: context.targetType,
    p_target_id: context.targetId ?? null,
    p_target_client_id: context.targetClientId ?? null,
    p_target_project_id: context.targetProjectId ?? null,
    p_context_route: context.contextRoute ?? null,
    p_metadata: mergedMetadata,
  })

  if (error) {
    console.error('Failed to log client-side activity', {
      error,
      verb: context.verb ?? event.verb,
      targetType: context.targetType,
      targetId: context.targetId ?? null,
    })
  }
}
