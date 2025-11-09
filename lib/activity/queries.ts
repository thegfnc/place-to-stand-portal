'use server'

import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  type SQL,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs, users } from '@/lib/db/schema'
import type { Database } from '@/supabase/types/database'

import type {
  ActivityLogWithActor,
  ActivityQueryFilters,
  ActivityQueryResult,
} from './types'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const DEFAULT_RECENT_ACTIVITY_LIMIT = 200

type SqlExpression = SQL<unknown>

type ActivityLogSelection = {
  log: {
    id: string
    actorId: string
    actorRole: Database['public']['Enums']['user_role']
    verb: string
    summary: string
    targetType: string
    targetId: string | null
    targetClientId: string | null
    targetProjectId: string | null
    contextRoute: string | null
    metadata: unknown
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    restoredAt: string | null
  }
  actor: {
    id: string | null
    fullName: string | null
    email: string | null
    avatarUrl: string | null
  } | null
}

const activityLogSelection = {
  id: activityLogs.id,
  actorId: activityLogs.actorId,
  actorRole: activityLogs.actorRole,
  verb: activityLogs.verb,
  summary: activityLogs.summary,
  targetType: activityLogs.targetType,
  targetId: activityLogs.targetId,
  targetClientId: activityLogs.targetClientId,
  targetProjectId: activityLogs.targetProjectId,
  contextRoute: activityLogs.contextRoute,
  metadata: activityLogs.metadata,
  createdAt: activityLogs.createdAt,
  updatedAt: activityLogs.updatedAt,
  deletedAt: activityLogs.deletedAt,
  restoredAt: activityLogs.restoredAt,
} as const

const actorSelection = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  avatarUrl: users.avatarUrl,
} as const

export async function fetchActivityLogs(
  filters: ActivityQueryFilters
): Promise<ActivityQueryResult> {
  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  )

  const whereClause = buildFilterConditions(filters)

  const baseQuery = db
    .select({
      log: activityLogSelection,
      actor: actorSelection,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

  const rows = (await filteredQuery
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit + 1)) as ActivityLogSelection[]

  const hasMore = rows.length > limit
  const limitedRows = hasMore ? rows.slice(0, limit) : rows
  const logs = limitedRows.map(mapToActivityLog)
  const nextCursor = hasMore
    ? limitedRows[limitedRows.length - 1]?.log.createdAt ?? null
    : null

  return {
    logs,
    hasMore,
    nextCursor,
  }
}

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
  const effectiveLimit = Math.min(
    Math.max(limit ?? DEFAULT_RECENT_ACTIVITY_LIMIT, 1),
    DEFAULT_RECENT_ACTIVITY_LIMIT
  )

  const whereClause = combineConditions([
    includeDeleted ? undefined : isNull(activityLogs.deletedAt),
    gte(activityLogs.createdAt, since),
    until ? lte(activityLogs.createdAt, until) : undefined,
  ])

  const baseQuery = db
    .select({
      log: activityLogSelection,
      actor: actorSelection,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

  const rows = (await filteredQuery
    .orderBy(asc(activityLogs.createdAt))
    .limit(effectiveLimit)) as ActivityLogSelection[]

  return rows.map(mapToActivityLog)
}

function buildFilterConditions(filters: ActivityQueryFilters) {
  const conditions: Array<SqlExpression | undefined> = []

  if (!filters.includeDeleted) {
    conditions.push(isNull(activityLogs.deletedAt))
  }

  if (filters.targetId) {
    conditions.push(eq(activityLogs.targetId, filters.targetId))
  }

  if (filters.projectId) {
    conditions.push(eq(activityLogs.targetProjectId, filters.projectId))
  }

  if (filters.clientId) {
    conditions.push(eq(activityLogs.targetClientId, filters.clientId))
  }

  if (filters.targetType) {
    const values = Array.isArray(filters.targetType)
      ? filters.targetType
      : [filters.targetType]

    if (values.length === 1) {
      conditions.push(eq(activityLogs.targetType, values[0]))
    } else if (values.length > 1) {
      conditions.push(inArray(activityLogs.targetType, values))
    }
  }

  if (filters.cursor) {
    conditions.push(lt(activityLogs.createdAt, filters.cursor))
  }

  return combineConditions(conditions)
}

function combineConditions(conditions: Array<SqlExpression | undefined>) {
  const filtered = conditions.filter(
    (condition): condition is SqlExpression => Boolean(condition)
  )

  if (!filtered.length) {
    return undefined
  }

  if (filtered.length === 1) {
    return filtered[0]
  }

  return and(...filtered)
}

function mapToActivityLog(row: ActivityLogSelection): ActivityLogWithActor {
  const { log, actor } = row
  const metadata =
    (log.metadata ?? {}) as ActivityLogWithActor['metadata']

  return {
    id: log.id,
    actor_id: log.actorId,
    actor_role: log.actorRole,
    verb: log.verb,
    summary: log.summary,
    target_type: log.targetType,
    target_id: log.targetId,
    target_client_id: log.targetClientId,
    target_project_id: log.targetProjectId,
    context_route: log.contextRoute,
    metadata,
    created_at: log.createdAt,
    updated_at: log.updatedAt,
    deleted_at: log.deletedAt,
    restored_at: log.restoredAt,
    actor:
      actor && actor.id
        ? {
            id: actor.id,
            full_name: actor.fullName,
            email: actor.email ?? '',
            avatar_url: actor.avatarUrl,
          }
        : null,
  }
}
