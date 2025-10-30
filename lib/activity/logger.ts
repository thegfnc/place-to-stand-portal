'use server'

import 'server-only'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/supabase/types/database'
import type { ActivityTargetType, ActivityVerb } from './types'

export type LogActivityOptions = {
  actorId: string
  actorRole?: Database['public']['Enums']['user_role'] | null
  verb: ActivityVerb
  summary: string
  targetType: ActivityTargetType | string
  targetId?: string | null
  targetClientId?: string | null
  targetProjectId?: string | null
  contextRoute?: string | null
  metadata?: Json
}

const normalizeMetadata = (metadata?: Json): Json | null => {
  if (metadata === undefined || metadata === null) {
    return null
  }

  return JSON.parse(JSON.stringify(metadata)) as Json
}

export async function logActivity(options: LogActivityOptions) {
  const supabase = getSupabaseServerClient()

  const { error } = await supabase.rpc('log_activity', {
    p_actor_id: options.actorId,
    p_actor_role: options.actorRole ?? null,
    p_verb: options.verb,
    p_summary: options.summary,
    p_target_type: options.targetType,
    p_target_id: options.targetId ?? null,
    p_target_client_id: options.targetClientId ?? null,
    p_target_project_id: options.targetProjectId ?? null,
    p_context_route: options.contextRoute ?? null,
    p_metadata: normalizeMetadata(options.metadata),
  })

  if (error) {
    console.error('Failed to log activity', {
      verb: options.verb,
      actorId: options.actorId,
      targetType: options.targetType,
      targetId: options.targetId ?? null,
      error,
    })
  }
}
