'use server'

import 'server-only'

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs, users } from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import type { ActivitySourceValue, UserRoleValue } from '@/lib/types'
import type { Json } from '@/lib/types/json'

import { attachActivityReferences } from './references'
import type {
  ActivityLogWithActor,
  ActivityQueryFilters,
  ActivityQueryResult,
} from './types'

/**
 * Page-view verbs were retired in Sep 2026 (they were ~half the table and
 * carried no information). Rows written before that stay in the table for
 * the record but never surface in a feed.
 */
const RETIRED_VERBS = ['PROJECT_VIEWED', 'CLIENT_VIEWED']

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const DEFAULT_RECENT_ACTIVITY_LIMIT = 200

type SqlExpression = SQL<unknown>

type ActivityLogSelection = {
  log: {
    id: string
    actorId: string | null
    actorRole: UserRoleValue | null
    source: ActivitySourceValue
    verb: string
    summary: string
    targetType: string
    targetId: string | null
    targetClientId: string | null
    targetProjectId: string | null
    contextRoute: string | null
    metadata: Json
    createdAt: string
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
  source: activityLogs.source,
  verb: activityLogs.verb,
  summary: activityLogs.summary,
  targetType: activityLogs.targetType,
  targetId: activityLogs.targetId,
  targetClientId: activityLogs.targetClientId,
  targetProjectId: activityLogs.targetProjectId,
  contextRoute: activityLogs.contextRoute,
  metadata: activityLogs.metadata,
  createdAt: activityLogs.createdAt,
} as const

const actorSelection = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  avatarUrl: users.avatarUrl,
} as const

/**
 * Access control lives here, not in the callers (this project has NO RLS):
 * the internal portal is admin-only, so callers must be admins and see
 * everything. Requested filters narrow the result set.
 */
export async function fetchActivityLogs(
  user: AppUser,
  filters: ActivityQueryFilters
): Promise<ActivityQueryResult> {
  assertAdmin(user)

  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  )

  const whereClause = combineConditions([buildFilterConditions(filters)])

  const baseQuery = db
    .select({
      log: activityLogSelection,
      actor: actorSelection,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

  // `id` breaks ties so rows sharing a `created_at` (bulk inserts land in the
  // same transaction timestamp) page deterministically instead of dropping.
  const rows = (await filteredQuery
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(limit + 1)) as ActivityLogSelection[]

  const hasMore = rows.length > limit
  const limitedRows = hasMore ? rows.slice(0, limit) : rows
  const logs = await attachActivityReferences(
    limitedRows.map(mapToActivityLog)
  )
  const lastRow = limitedRows[limitedRows.length - 1]
  const nextCursor =
    hasMore && lastRow ? encodeCursor(lastRow.log.createdAt, lastRow.log.id) : null

  return {
    logs,
    hasMore,
    nextCursor,
  }
}

/**
 * Returns the NEWEST logs in the window (oldest first, for prompting) with NO row scoping — admin-only, enforced
 * structurally: the caller must pass the current user and non-admins throw
 * ForbiddenError, so a future non-admin call site fails loudly instead of
 * silently leaking. (Sole caller today: the dashboard recent-activity
 * summary route, which additionally 403s non-admins up front.)
 */
export async function fetchActivityLogsSince(
  user: AppUser,
  {
    since,
    until,
    limit,
  }: {
    since: string
    until?: string
    limit?: number
  }
): Promise<ActivityLogWithActor[]> {
  assertAdmin(user)

  const effectiveLimit = Math.min(
    Math.max(limit ?? DEFAULT_RECENT_ACTIVITY_LIMIT, 1),
    DEFAULT_RECENT_ACTIVITY_LIMIT
  )

  const whereClause = combineConditions([
    notInArray(activityLogs.verb, RETIRED_VERBS),
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

  // Take the newest `limit` rows, then flip to chronological order. Ordering
  // ascending with a limit returned the *oldest* rows of a busy window, so the
  // "recent activity" briefing described the start of the week, not the end.
  const rows = (await filteredQuery
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(effectiveLimit)) as ActivityLogSelection[]

  return rows.reverse().map(mapToActivityLog)
}

function buildFilterConditions(filters: ActivityQueryFilters) {
  const conditions: Array<SqlExpression | undefined> = []

  conditions.push(notInArray(activityLogs.verb, RETIRED_VERBS))

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
    const cursor = decodeCursor(filters.cursor)
    conditions.push(
      cursor.id
        ? or(
            lt(activityLogs.createdAt, cursor.createdAt),
            and(
              eq(activityLogs.createdAt, cursor.createdAt),
              lt(activityLogs.id, cursor.id)
            )
          )
        : lt(activityLogs.createdAt, cursor.createdAt)
    )
  }

  return combineConditions(conditions)
}

const CURSOR_SEPARATOR = "|"

function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}${CURSOR_SEPARATOR}${id}`
}

/** Accepts the legacy bare-timestamp cursor so in-flight clients keep paging. */
function decodeCursor(value: string): { createdAt: string; id: string | null } {
  const separatorIndex = value.lastIndexOf(CURSOR_SEPARATOR)
  if (separatorIndex === -1) {
    return { createdAt: value, id: null }
  }
  return {
    createdAt: value.slice(0, separatorIndex),
    id: value.slice(separatorIndex + 1) || null,
  }
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
  const metadata = (log.metadata ?? {}) as ActivityLogWithActor['metadata']

  return {
    id: log.id,
    actor_id: log.actorId,
    actor_role: log.actorRole,
    source: log.source,
    verb: log.verb,
    summary: log.summary,
    target_type: log.targetType,
    target_id: log.targetId,
    target_client_id: log.targetClientId,
    target_project_id: log.targetProjectId,
    context_route: log.contextRoute,
    metadata,
    created_at: log.createdAt,
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
