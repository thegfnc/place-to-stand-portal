import 'server-only'

import { and, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientMembers, taskAssignees } from '@/lib/db/schema'

export type UsersSettingsAssignments = Record<
  string,
  { clients: number; projects: number; tasks: number }
>

export async function buildAssignmentsForUsers(
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

export async function getActiveClientMembershipCounts(user: AppUser) {
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

export async function getActiveTaskAssignmentCounts(user: AppUser) {
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

