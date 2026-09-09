import 'server-only'

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  clientMembers,
  clients,
  projects,
  taskAssignees,
} from '@/lib/db/schema'
import type { ProjectTypeValue } from '@/lib/types'

export type UserAssignedClient = {
  id: string
  name: string
  slug: string | null
}

export type UserAssignedProject = {
  id: string
  name: string
  slug: string | null
  type: ProjectTypeValue
  /** Slug of the owning client; null for internal/personal projects. */
  clientSlug: string | null
}

export type UserAssignmentSummary = {
  clients: number
  projects: number
  tasks: number
  clientList: UserAssignedClient[]
  projectList: UserAssignedProject[]
}

export type UsersSettingsAssignments = Record<string, UserAssignmentSummary>

const emptySummary = (): UserAssignmentSummary => ({
  clients: 0,
  projects: 0,
  tasks: 0,
  clientList: [],
  projectList: [],
})

/**
 * Per-user assignment summary for the settings users table and the archive
 * confirmation copy — three grouped queries regardless of page size.
 * Clients are live `client_members` rows on live clients; projects are live
 * projects the user owns (`projects.owner_id`); tasks are live
 * `task_assignees` rows. The client/project lists back the hover cards, so
 * their counts are the list lengths.
 */
export async function buildAssignmentsForUsers(
  userIds: string[]
): Promise<UsersSettingsAssignments> {
  if (!userIds.length) {
    return {}
  }

  const [clientRows, projectRows, taskCounts] = await Promise.all([
    db
      .select({
        userId: clientMembers.userId,
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
      })
      .from(clientMembers)
      .innerJoin(clients, eq(clientMembers.clientId, clients.id))
      .where(
        and(
          inArray(clientMembers.userId, userIds),
          isNull(clientMembers.deletedAt),
          isNull(clients.deletedAt)
        )
      )
      .orderBy(asc(clients.name)),
    db
      .select({
        userId: projects.ownerId,
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        type: projects.type,
        clientSlug: clients.slug,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(inArray(projects.ownerId, userIds), isNull(projects.deletedAt))
      )
      .orderBy(asc(projects.name)),
    db
      .select({
        userId: taskAssignees.userId,
        total: sql<number>`count(distinct ${taskAssignees.id})`,
      })
      .from(taskAssignees)
      .where(
        and(
          inArray(taskAssignees.userId, userIds),
          isNull(taskAssignees.deletedAt)
        )
      )
      .groupBy(taskAssignees.userId),
  ])

  const assignments: UsersSettingsAssignments = {}
  const summaryFor = (userId: string) =>
    (assignments[userId] ??= emptySummary())

  for (const userId of userIds) {
    summaryFor(userId)
  }

  for (const row of clientRows) {
    const summary = summaryFor(row.userId)
    summary.clientList.push({ id: row.id, name: row.name, slug: row.slug })
    summary.clients = summary.clientList.length
  }

  for (const row of projectRows) {
    if (!row.userId) continue
    const summary = summaryFor(row.userId)
    summary.projectList.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      clientSlug: row.clientSlug,
    })
    summary.projects = summary.projectList.length
  }

  for (const row of taskCounts) {
    summaryFor(row.userId).tasks = Number(row.total ?? 0)
  }

  return assignments
}
