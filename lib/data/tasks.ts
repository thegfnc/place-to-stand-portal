import 'server-only'

import { cache } from 'react'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { UserRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  clients as clientsTable,
  clientMembers as clientMembersTable,
  projects as projectsTable,
  taskAssignees as taskAssigneesTable,
  tasks as tasksTable,
} from '@/lib/db/schema'

export type AssignedTaskSummary = {
  id: string
  title: string
  status: string
  dueOn: string | null
  updatedAt: string | null
  project: {
    id: string
    name: string
    slug: string | null
  }
  client: {
    id: string
    name: string
    slug: string | null
  } | null
}

const DEFAULT_LIMIT = 12

const ACTIVE_STATUS_VALUES = [
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
] as const

const STATUS_PRIORITY_SQL = sql`
  CASE
    WHEN ${tasksTable.status} = 'BLOCKED' THEN 0
    WHEN ${tasksTable.status} = 'IN_PROGRESS' THEN 1
    WHEN ${tasksTable.status} = 'IN_REVIEW' THEN 2
    WHEN ${tasksTable.status} = 'ON_DECK' THEN 3
    WHEN ${tasksTable.status} = 'BACKLOG' THEN 4
    WHEN ${tasksTable.status} = 'DONE' THEN 5
    WHEN ${tasksTable.status} = 'ARCHIVED' THEN 6
    ELSE 999
  END
`

type FetchAssignedTasksSummaryOptions = {
  userId: string
  role: UserRole
  limit?: number
  includeCompletedStatuses?: boolean
}

export const fetchAssignedTasksSummary = cache(
  async ({
    userId,
    role,
    limit = DEFAULT_LIMIT,
    includeCompletedStatuses = false,
  }: FetchAssignedTasksSummaryOptions): Promise<AssignedTaskSummary[]> => {
    const effectiveLimit = Math.max(1, limit)
    const shouldScopeToUser = role !== 'ADMIN'

    let accessibleClientIds: string[] = []

    if (shouldScopeToUser) {
      const memberships = await db
        .select({ clientId: clientMembersTable.clientId })
        .from(clientMembersTable)
        .where(
          and(
            eq(clientMembersTable.userId, userId),
            isNull(clientMembersTable.deletedAt)
          )
        )

      accessibleClientIds = memberships
        .map(entry => entry.clientId)
        .filter((value): value is string => Boolean(value))

      if (accessibleClientIds.length === 0) {
        return []
      }
    }

    let whereClause = and(
      eq(taskAssigneesTable.userId, userId),
      isNull(taskAssigneesTable.deletedAt),
      isNull(tasksTable.deletedAt),
      isNull(projectsTable.deletedAt)
    )

    if (!includeCompletedStatuses) {
      whereClause = and(
        whereClause,
        inArray(tasksTable.status, ACTIVE_STATUS_VALUES)
      )
    }

    if (shouldScopeToUser) {
      whereClause = and(
        whereClause,
        inArray(projectsTable.clientId, accessibleClientIds)
      )
    }

    const rows = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        dueOn: tasksTable.dueOn,
        updatedAt: tasksTable.updatedAt,
        createdAt: tasksTable.createdAt,
        project: {
          id: projectsTable.id,
          name: projectsTable.name,
          slug: projectsTable.slug,
        },
        client: {
          id: clientsTable.id,
          name: clientsTable.name,
          slug: clientsTable.slug,
        },
      })
      .from(taskAssigneesTable)
      .innerJoin(tasksTable, eq(taskAssigneesTable.taskId, tasksTable.id))
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
      .where(whereClause)
      .orderBy(
        sql`CASE WHEN ${tasksTable.dueOn} IS NULL THEN 1 ELSE 0 END`,
        sql`${tasksTable.dueOn} ASC`,
        STATUS_PRIORITY_SQL,
        sql`COALESCE(${tasksTable.updatedAt}, ${tasksTable.createdAt}) DESC`,
        sql`${tasksTable.title} ASC`
      )
      .limit(effectiveLimit)

    return rows.map(row => {
      const updatedSource = row.updatedAt ?? row.createdAt ?? null

      return {
        id: row.id,
        title: row.title,
        status: row.status,
        dueOn: row.dueOn ?? null,
        updatedAt: updatedSource,
        project: {
          id: row.project.id,
          name: row.project.name,
          slug: row.project.slug ?? null,
        },
        client: row.client?.id
          ? {
              id: row.client.id,
              name: row.client.name,
              slug: row.client.slug ?? null,
            }
          : null,
      }
    })
  }
)
