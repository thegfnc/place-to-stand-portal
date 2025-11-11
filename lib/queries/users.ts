import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin, assertIsSelf, isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  taskAssignees,
  users,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'

type SelectUser = typeof users.$inferSelect

const userFields = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
}

export async function listUsers(
  user: AppUser,
): Promise<SelectUser[]> {
  const baseQuery = db.select(userFields).from(users)

  if (isAdmin(user)) {
    return baseQuery.orderBy(desc(users.createdAt))
  }

  return baseQuery
    .where(eq(users.id, user.id))
    .orderBy(desc(users.createdAt))
}

export async function getUserById(
  user: AppUser,
  userId: string,
): Promise<SelectUser> {
  assertIsSelf(user, userId)

  const result = await db
    .select(userFields)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('User not found')
  }

  return result[0]
}

export type UserWithAssignmentCounts = SelectUser & {
  clientsCount: number
  tasksCount: number
}

export type UsersSettingsListItem = SelectUser

export type ListUsersForSettingsInput = {
  status?: 'active' | 'archived'
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

export type UsersSettingsAssignments = Record<
  string,
  { clients: number; projects: number; tasks: number }
>

export type UsersSettingsResult = {
  items: UsersSettingsListItem[]
  assignments: UsersSettingsAssignments
  totalCount: number
  pageInfo: PageInfo
}

export async function listUsersWithAssignmentCounts(
  user: AppUser,
): Promise<UserWithAssignmentCounts[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      user: userFields,
      clientsCount: sql<number>`count(distinct ${clientMembers.id})`,
      tasksCount: sql<number>`count(distinct ${taskAssignees.id})`,
    })
    .from(users)
    .leftJoin(
      clientMembers,
      and(
        eq(clientMembers.userId, users.id),
        isNull(clientMembers.deletedAt),
      ),
    )
    .leftJoin(
      taskAssignees,
      and(eq(taskAssignees.userId, users.id), isNull(taskAssignees.deletedAt)),
    )
    .groupBy(
      users.id,
      users.email,
      users.fullName,
      users.avatarUrl,
      users.role,
      users.createdAt,
      users.updatedAt,
      users.deletedAt,
    )
    .orderBy(desc(users.createdAt))

  return rows.map(row => ({
    id: row.user.id,
    email: row.user.email,
    fullName: row.user.fullName,
    avatarUrl: row.user.avatarUrl,
    role: row.user.role,
    createdAt: row.user.createdAt,
    updatedAt: row.user.updatedAt,
    deletedAt: row.user.deletedAt,
    clientsCount: Number(row.clientsCount ?? 0),
    tasksCount: Number(row.tasksCount ?? 0),
  }))
}

const userSortExpression = sql<string>`
  coalesce(nullif(${users.fullName}, ''), ${users.email}, '')
`

function buildUserCursorCondition(
  direction: CursorDirection,
  cursor: { name?: string | null; id?: string | null } | null,
): SQL | null {
  if (!cursor) {
    return null
  }

  const idValue = typeof cursor.id === 'string' ? cursor.id : ''
  const nameValue = typeof cursor.name === 'string' ? cursor.name : cursor.name ?? ''

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

async function buildAssignmentsForUsers(
  userIds: string[],
): Promise<UsersSettingsAssignments> {
  if (!userIds.length) {
    return {}
  }

  const [clientCounts, taskCounts] = await Promise.all([
    db
      .select({
        userId: clientMembers.userId,
        total: sql<number>`count(distinct ${clientMembers.id})`,
      })
      .from(clientMembers)
      .where(
        and(
          inArray(clientMembers.userId, userIds),
          isNull(clientMembers.deletedAt),
        ),
      )
      .groupBy(clientMembers.userId),
    db
      .select({
        userId: taskAssignees.userId,
        total: sql<number>`count(distinct ${taskAssignees.id})`,
      })
      .from(taskAssignees)
      .where(
        and(
          inArray(taskAssignees.userId, userIds),
          isNull(taskAssignees.deletedAt),
        ),
      )
      .groupBy(taskAssignees.userId),
  ])

  const assignments: UsersSettingsAssignments = userIds.reduce<
    UsersSettingsAssignments
  >((acc, userId) => {
    acc[userId] = { clients: 0, projects: 0, tasks: 0 }
    return acc
  }, {})

  for (const row of clientCounts) {
    if (!assignments[row.userId]) {
      assignments[row.userId] = { clients: 0, projects: 0, tasks: 0 }
    }
    assignments[row.userId].clients = Number(row.total ?? 0)
  }

  for (const row of taskCounts) {
    if (!assignments[row.userId]) {
      assignments[row.userId] = { clients: 0, projects: 0, tasks: 0 }
    }
    assignments[row.userId].tasks = Number(row.total ?? 0)
  }

  return assignments
}

export async function softDeleteUser(
  user: AppUser,
  userId: string,
): Promise<string> {
  assertAdmin(user)

  const deletedAt = new Date().toISOString()

  await db
    .update(users)
    .set({ deletedAt })
    .where(eq(users.id, userId))

  return deletedAt
}

export async function restoreUser(
  user: AppUser,
  userId: string,
) {
  assertAdmin(user)

  await db
    .update(users)
    .set({ deletedAt: null })
    .where(eq(users.id, userId))
}

export async function getActiveClientMembershipCounts(
  user: AppUser,
) {
  assertAdmin(user)

  const rows = await db
    .select({
      userId: clientMembers.userId,
      total: sql<number>`count(*)`.mapWith(Number).as('total'),
    })
    .from(clientMembers)
    .where(isNull(clientMembers.deletedAt))
    .groupBy(clientMembers.userId)

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.userId] = row.total
    return acc
  }, {})
}

export async function getActiveTaskAssignmentCounts(
  user: AppUser,
) {
  assertAdmin(user)

  const rows = await db
    .select({
      userId: taskAssignees.userId,
      total: sql<number>`count(*)`.mapWith(Number).as('total'),
    })
    .from(taskAssignees)
    .where(isNull(taskAssignees.deletedAt))
    .groupBy(taskAssignees.userId)

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.userId] = row.total
    return acc
  }, {})
}

export async function getUserAvatarPath(userId: string): Promise<string> {
  const result = await db
    .select({
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Avatar not found')
  }

  const avatarUrl = result[0].avatarUrl

  if (!avatarUrl) {
    throw new NotFoundError('Avatar not found')
  }

  return avatarUrl
}

