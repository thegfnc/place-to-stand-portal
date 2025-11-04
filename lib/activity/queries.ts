'use server'

import 'server-only'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import type {
  ActivityLogWithActor,
  ActivityQueryFilters,
  ActivityQueryResult,
} from './types'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

export async function fetchActivityLogs(
  filters: ActivityQueryFilters
): Promise<ActivityQueryResult> {
  const supabase = getSupabaseServerClient()
  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  )

  let query = supabase
    .from('activity_logs')
    .select(
      `
        id,
        actor_id,
        actor_role,
        verb,
        summary,
        target_type,
        target_id,
        target_client_id,
        target_project_id,
        context_route,
        metadata,
        created_at,
        updated_at,
        deleted_at,
        restored_at,
        actor:users (
          id,
          full_name,
          email,
          avatar_url
        )
      `
    )
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (!filters.includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (filters.targetId) {
    query = query.eq('target_id', filters.targetId)
  }

  if (filters.projectId) {
    query = query.eq('target_project_id', filters.projectId)
  }

  if (filters.clientId) {
    query = query.eq('target_client_id', filters.clientId)
  }

  if (filters.targetType) {
    const values = Array.isArray(filters.targetType)
      ? filters.targetType
      : [filters.targetType]
    query = query.in('target_type', values)
  }

  if (filters.cursor) {
    query = query.lt('created_at', filters.cursor)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch activity logs', error)
    throw error
  }

  const rows = (data ?? []) as ActivityLogWithActor[]
  const hasMore = rows.length > limit
  const limited = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore
    ? (limited[limited.length - 1]?.created_at ?? null)
    : null

  return {
    logs: limited,
    hasMore,
    nextCursor,
  }
}

const DEFAULT_RECENT_ACTIVITY_LIMIT = 200

export async function fetchActivityLogsSince({
  since,
  until,
  limit,
  includeDeleted,
}: {
  since: string
  until?: string
  limit?: number
  includeDeleted?: boolean
}): Promise<ActivityLogWithActor[]> {
  const supabase = getSupabaseServerClient()
  const effectiveLimit = Math.min(
    Math.max(limit ?? DEFAULT_RECENT_ACTIVITY_LIMIT, 1),
    DEFAULT_RECENT_ACTIVITY_LIMIT
  )

  let query = supabase
    .from('activity_logs')
    .select(
      `
        id,
        actor_id,
        actor_role,
        verb,
        summary,
        target_type,
        target_id,
        target_client_id,
        target_project_id,
        context_route,
        metadata,
        created_at,
        updated_at,
        deleted_at,
        restored_at,
        actor:users (
          id,
          full_name,
          email,
          avatar_url
        )
      `
    )
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(effectiveLimit)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (until) {
    query = query.lte('created_at', until)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch activity logs by timeframe', error)
    throw error
  }

  return (data ?? []) as ActivityLogWithActor[]
}
