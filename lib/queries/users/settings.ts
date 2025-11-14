import 'server-only'

import { and, asc, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'

import { userSortExpression, type SelectUser } from './fields'
import {
  buildAssignmentsForUsers,
  type UsersSettingsAssignments,
} from './assignments'

export type UsersSettingsListItem = SelectUser

export type ListUsersForSettingsInput = {
  status?: 'active' | 'archived'
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

export type UsersSettingsResult = {
  items: UsersSettingsListItem[]
  assignments: UsersSettingsAssignments
  totalCount: number
  pageInfo: PageInfo
}

function buildUserCursorCondition(
  direction: CursorDirection,
  cursor: { name?: string | null; id?: string | null } | null,
): SQL | null {
  if (!cursor) {
    return null
  }

  const idValue = typeof cursor.id === 'string' ? cursor.id : ''
  const nameValue =
    typeof cursor.name === 'string' ? cursor.name : cursor.name ?? ''

  if (!idValue) {
    return null
  }

  if (direction === 'forward') {
    return sql`${userSortExpression} > ${nameValue} OR (${userSortExpression} = ${nameValue} AND ${users.id} > ${idValue})`
  }

  return sql`${userSortExpression} < ${nameValue} OR (${userSortExpression} = ${nameValue} AND ${users.id} < ${idValue})`
}

export async function listUsersForSettings(
  user: AppUser,
  input: ListUsersForSettingsInput = {},
): Promise<UsersSettingsResult> {
  assertAdmin(user)

  const direction = resolveDirection(input.direction)
  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const baseConditions: SQL[] = []

  if (normalizedStatus === 'active') {
    baseConditions.push(isNull(users.deletedAt))
  } else {
    baseConditions.push(sql`${users.deletedAt} IS NOT NULL`)
  }

  const cursorPayload = decodeCursor<{ name?: string; id?: string }>(
    input.cursor,
  )
  const cursorCondition = buildUserCursorCondition(direction, cursorPayload)
  const paginatedConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions

  const whereClause =
    paginatedConditions.length > 0 ? and(...paginatedConditions) : undefined

  const ordering =
    direction === 'forward'
      ? [asc(userSortExpression), asc(users.id)]
      : [sql`${userSortExpression} DESC`, sql`${users.id} DESC`]

  const rows = (await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(...ordering)
    .limit(limit + 1)) as UsersSettingsListItem[]

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const mappedItems = normalizedRows.map(row => ({
    ...row,
  }))

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(baseConditions.length ? and(...baseConditions) : undefined)

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const firstItem = mappedItems[0] ?? null
  const lastItem = mappedItems[mappedItems.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward' ? Boolean(cursorPayload) : hasExtraRecord
  const hasNextPage =
    direction === 'forward' ? hasExtraRecord : Boolean(cursorPayload)

  const pageInfo: PageInfo = {
    hasPreviousPage,
    hasNextPage,
    startCursor: firstItem
      ? encodeCursor({
          name: firstItem.fullName ?? firstItem.email ?? '',
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeCursor({
          name: lastItem.fullName ?? lastItem.email ?? '',
          id: lastItem.id,
        })
      : null,
  }

  const userIds = mappedItems.map(item => item.id)
  const assignments = await buildAssignmentsForUsers(userIds)

  return {
    items: mappedItems,
    assignments,
    totalCount,
    pageInfo,
  }
}

