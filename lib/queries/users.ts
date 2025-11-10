import 'server-only'

import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin, assertIsSelf, isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  taskAssignees,
  users,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

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

