import 'server-only'

import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin, assertIsSelf, isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientMembers, taskAssignees, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import { userFields, type SelectUser } from './fields'

export type UserWithAssignmentCounts = SelectUser & {
  clientsCount: number
  tasksCount: number
}

export async function listUsers(user: AppUser): Promise<SelectUser[]> {
  const baseQuery = db.select(userFields).from(users)

  if (isAdmin(user)) {
    return baseQuery.orderBy(desc(users.createdAt))
  }

  return baseQuery.where(eq(users.id, user.id)).orderBy(desc(users.createdAt))
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
      and(eq(clientMembers.userId, users.id), isNull(clientMembers.deletedAt)),
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

