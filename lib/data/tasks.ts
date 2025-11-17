import 'server-only'

import { cache } from 'react'
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'

import type { UserRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  clients as clientsTable,
  clientMembers as clientMembersTable,
  projects as projectsTable,
  taskAssigneeMetadata as taskAssigneeMetadataTable,
  taskAssignees as taskAssigneesTable,
  tasks as tasksTable,
} from '@/lib/db/schema'

export type AssignedTaskSummary = {
  id: string
  title: string
  description: string | null
  status: string
  dueOn: string | null
  updatedAt: string | null
  sortOrder: number | null
  project: {
    id: string
    name: string
    slug: string | null
    isInternal: boolean
    isPersonal: boolean
    createdBy: string | null
  }
  client: {
    id: string
    name: string
    slug: string | null
  } | null
}

export type AssignedTaskSummaryResult = {
  items: AssignedTaskSummary[]
  totalCount: number
}

const DEFAULT_LIMIT = 12

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
  limit?: number | null
}

async function loadAssignedTaskSummaries({
  userId,
  role,
  limit = DEFAULT_LIMIT,
}: FetchAssignedTasksSummaryOptions): Promise<AssignedTaskSummaryResult> {
  const shouldScopeToUser = role !== 'ADMIN'

  const normalizedLimit =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.max(1, limit)
      : limit === null
        ? null
        : DEFAULT_LIMIT

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
  }

  const baseConditions = [
    eq(taskAssigneesTable.userId, userId),
    isNull(taskAssigneesTable.deletedAt),
    isNull(tasksTable.deletedAt),
    isNull(projectsTable.deletedAt),
    isNull(tasksTable.acceptedAt),
    ne(tasksTable.status, 'ARCHIVED'),
    ne(tasksTable.status, 'BACKLOG'),
  ]

  if (shouldScopeToUser) {
    let accessCondition: SQL<unknown> = or(
      eq(projectsTable.isInternal, true),
      and(eq(projectsTable.isPersonal, true), eq(projectsTable.createdBy, userId))
    )!

    if (accessibleClientIds.length > 0) {
      accessCondition = or(
        accessCondition,
        inArray(projectsTable.clientId, accessibleClientIds)
      )!
    }

    baseConditions.push(accessCondition as SQL)
  }

  const whereClause = and(...baseConditions)

  const orderExpressions = [
    sql`CASE WHEN ${taskAssigneeMetadataTable.sortOrder} IS NULL THEN 1 ELSE 0 END`,
    asc(taskAssigneeMetadataTable.sortOrder),
    sql`CASE WHEN ${tasksTable.dueOn} IS NULL THEN 1 ELSE 0 END`,
    asc(tasksTable.dueOn),
    STATUS_PRIORITY_SQL,
    desc(sql`COALESCE(${tasksTable.updatedAt}, ${tasksTable.createdAt})`),
    asc(tasksTable.title),
  ]

  const baseQuery = db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      dueOn: tasksTable.dueOn,
      updatedAt: tasksTable.updatedAt,
      createdAt: tasksTable.createdAt,
      sortOrder: taskAssigneeMetadataTable.sortOrder,
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        slug: projectsTable.slug,
        isInternal: projectsTable.isInternal,
        isPersonal: projectsTable.isPersonal,
        createdBy: projectsTable.createdBy,
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
    .leftJoin(
      taskAssigneeMetadataTable,
      and(
        eq(taskAssigneeMetadataTable.taskId, tasksTable.id),
        eq(taskAssigneeMetadataTable.userId, taskAssigneesTable.userId),
        isNull(taskAssigneeMetadataTable.deletedAt)
      )
    )
    .where(whereClause)
    .orderBy(...orderExpressions)

  const rows =
    normalizedLimit !== null
      ? await baseQuery.limit(normalizedLimit)
      : await baseQuery

  const totalResult = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(taskAssigneesTable)
    .innerJoin(tasksTable, eq(taskAssigneesTable.taskId, tasksTable.id))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(whereClause)

  const totalCount = Number(totalResult[0]?.count ?? 0)

  const items: AssignedTaskSummary[] = rows.map(row => {
    const updatedSource = row.updatedAt ?? row.createdAt ?? null

    return {
      id: row.id,
      title: row.title ?? '',
      description: row.description ?? null,
      status: row.status ?? 'BACKLOG',
      dueOn: row.dueOn ?? null,
      updatedAt: updatedSource,
      sortOrder: row.sortOrder ?? null,
      project: {
        id: row.project.id,
        name: row.project.name ?? 'Untitled project',
        slug: row.project.slug ?? null,
        isInternal: row.project.isInternal ?? false,
        isPersonal: row.project.isPersonal ?? false,
        createdBy: row.project.createdBy ?? null,
      },
      client: row.client?.id
        ? {
            id: row.client.id,
            name: row.client.name ?? 'Unnamed client',
            slug: row.client.slug ?? null,
          }
        : null,
    }
  })

  return { items, totalCount }
}

export const fetchAssignedTasksSummary = cache(
  (options: FetchAssignedTasksSummaryOptions) => loadAssignedTaskSummaries(options)
)

export function listAssignedTaskSummaries(
  options: FetchAssignedTasksSummaryOptions
) {
  return loadAssignedTaskSummaries(options)
}
