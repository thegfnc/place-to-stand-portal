import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import {
  clientMembers,
  taskAssignees,
  type UserRow,
  users,
} from '@/lib/db/schema'

export type AssignmentCounts = Record<
  string,
  { clients: number; projects: number; tasks: number }
>

export async function fetchUsersWithAssignments(): Promise<{
  users: UserRow[]
  assignments: AssignmentCounts
}> {
  const [userRows, clientMembershipCounts, taskAssignmentCounts] =
    await Promise.all([
      db.select().from(users).orderBy(desc(users.created_at)),
      db
        .select({
          userId: clientMembers.user_id,
          total: sql<number>`count(*)`,
        })
        .from(clientMembers)
        .where(isNull(clientMembers.deleted_at))
        .groupBy(clientMembers.user_id),
      db
        .select({
          userId: taskAssignees.user_id,
          total: sql<number>`count(*)`,
        })
        .from(taskAssignees)
        .where(isNull(taskAssignees.deleted_at))
        .groupBy(taskAssignees.user_id),
    ])

  const assignments: AssignmentCounts = {}

  const ensureCounts = (userId: string) => {
    if (!assignments[userId]) {
      assignments[userId] = { clients: 0, projects: 0, tasks: 0 }
    }
    return assignments[userId]
  }

  for (const entry of clientMembershipCounts) {
    const summary = ensureCounts(entry.userId)
    summary.clients = Number(entry.total ?? 0)
  }

  for (const entry of taskAssignmentCounts) {
    const summary = ensureCounts(entry.userId)
    summary.tasks = Number(entry.total ?? 0)
  }

  for (const user of userRows) {
    ensureCounts(user.id)
  }

  return { users: userRows, assignments }
}

export async function insertUserProfile(values: {
  id: string
  email: string
  full_name: string | null
  role: UserRow['role']
  avatar_url: string | null
}) {
  await db.insert(users).values({
    id: values.id,
    email: values.email,
    full_name: values.full_name,
    role: values.role,
    avatar_url: values.avatar_url,
  })
}

export async function updateUserProfile(
  id: string,
  values: Partial<Pick<UserRow, 'full_name' | 'role' | 'avatar_url' | 'deleted_at'>>
) {
  await db.update(users).set(values).where(eq(users.id, id))
}

export async function deleteUserProfile(id: string) {
  await db.delete(users).where(eq(users.id, id))
}

export async function deleteClientMemberships(userId: string) {
  await db.delete(clientMembers).where(eq(clientMembers.user_id, userId))
}

export async function deleteTaskAssignments(userId: string) {
  await db.delete(taskAssignees).where(eq(taskAssignees.user_id, userId))
}

export async function archiveClientMemberships(userId: string, deletedAt: string) {
  await db
    .update(clientMembers)
    .set({ deleted_at: deletedAt })
    .where(
      and(eq(clientMembers.user_id, userId), isNull(clientMembers.deleted_at))
    )
}

export async function archiveTaskAssignments(userId: string, deletedAt: string) {
  await db
    .update(taskAssignees)
    .set({ deleted_at: deletedAt })
    .where(
      and(eq(taskAssignees.user_id, userId), isNull(taskAssignees.deleted_at))
    )
}

export async function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}
