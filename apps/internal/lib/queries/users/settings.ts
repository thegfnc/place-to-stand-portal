import 'server-only'

import { and, asc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import type { UserAccessFilter, UserSortField } from '@/lib/settings/users/filters'
import { DEFAULT_USERS_SORT } from '@/lib/settings/users/filters'
import type { UserRoleValue } from '@/lib/types'
import { clampLimit, createSearchPattern } from '@/lib/pagination/cursor'
import type { ParsedSort } from '@/lib/pagination/sort'

import { userSortExpression, type SelectUser } from './fields'
import {
  buildAssignmentsForUsers,
  type UsersSettingsAssignments,
} from './assignments'

type UsersSettingsListItem = SelectUser

export type ListUsersForSettingsInput = {
  status?: 'active' | 'archived'
  /** 1-based page number; out-of-range values clamp to the last page. */
  page?: number | null
  limit?: number | null
  role?: UserRoleValue
  access?: UserAccessFilter
  search?: string
  sort?: ParsedSort<UserSortField>
}

export type UsersSettingsResult = {
  items: UsersSettingsListItem[]
  assignments: UsersSettingsAssignments
  /** Rows matching the active filters/search (drives `Showing N of M`). */
  totalCount: number
  /** Rows on the tab regardless of filters/search (the `M`). */
  unfilteredTotalCount: number
  /** The page actually served (after clamping). */
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Per-sort descriptor (PRD 004 §03, R5): order expressions per field. Both
 * fields are non-nullable so no null partition applies; a nullable field
 * added here must declare NULLS LAST ordering.
 */
type UserSortDescriptor = {
  orderAsc: SQL
  orderDesc: SQL
}

const USER_SORT_DESCRIPTORS: Record<UserSortField, UserSortDescriptor> = {
  name: {
    orderAsc: sql`${userSortExpression} ASC`,
    orderDesc: sql`${userSortExpression} DESC`,
  },
  created: {
    orderAsc: sql`${users.createdAt} ASC`,
    orderDesc: sql`${users.createdAt} DESC`,
  },
}

export async function listUsersForSettings(
  user: AppUser,
  input: ListUsersForSettingsInput = {},
): Promise<UsersSettingsResult> {
  assertAdmin(user)

  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const sort = input.sort ?? DEFAULT_USERS_SORT
  const descriptor = USER_SORT_DESCRIPTORS[sort.field]

  const statusCondition =
    normalizedStatus === 'active'
      ? isNull(users.deletedAt)
      : sql`${users.deletedAt} IS NOT NULL`

  const baseConditions: SQL[] = [statusCondition]

  // Role/access/search filters live in baseConditions so totalCount follows.
  if (input.role) {
    baseConditions.push(eq(users.role, input.role))
  }
  if (input.access === 'enabled') {
    baseConditions.push(isNull(users.disabledAt))
  }
  if (input.access === 'disabled') {
    baseConditions.push(isNotNull(users.disabledAt))
  }
  const searchQuery = input.search?.trim() ?? ''
  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${userSortExpression} ILIKE ${pattern} OR ${users.email} ILIKE ${pattern})`,
    )
  }

  const whereClause = and(...baseConditions)

  // Counts come first so an out-of-range ?page= (stale link, rows deleted)
  // clamps to the real last page instead of serving an empty list.
  const [totalResult, unfilteredTotalResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(statusCondition),
  ])

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const unfilteredTotalCount = Number(unfilteredTotalResult[0]?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const requestedPage = Math.floor(input.page ?? 1)
  const page = Math.min(Math.max(1, requestedPage), totalPages)

  const ordering =
    sort.direction === 'asc'
      ? [descriptor.orderAsc, asc(users.id)]
      : [descriptor.orderDesc, sql`${users.id} DESC`]

  const items = (await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
      disabledAt: users.disabledAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(...ordering)
    .limit(limit)
    .offset((page - 1) * limit)) as UsersSettingsListItem[]

  const userIds = items.map(item => item.id)
  const assignments = await buildAssignmentsForUsers(userIds)

  return {
    items,
    assignments,
    totalCount,
    unfilteredTotalCount,
    page,
    pageSize: limit,
    totalPages,
  }
}
