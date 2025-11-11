import { and, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients as clientsTable,
  clientMembers as clientMembersTable,
  hourBlocks as hourBlocksTable,
  taskAssignees as taskAssigneesTable,
  taskAttachments as taskAttachmentsTable,
  taskComments as taskCommentsTable,
  tasks as tasksTable,
  users as usersTable,
} from '@/lib/db/schema'
import type { DbClient, DbTask, DbUser } from '@/lib/types'

import type {
  ClientMembership,
  MemberWithUser,
  RawHourBlock,
  RawTaskWithRelations,
} from './types'

type ClientRow = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

type MemberRow = {
  membership: {
    id: number
    clientId: string
    userId: string
    createdAt: string
    deletedAt: string | null
  }
  user: {
    id: string
    email: string
    fullName: string | null
    role: DbUser['role']
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
  } | null
}

type HourBlockRow = {
  id: string
  clientId: string | null
  hoursPurchased: string | number
  deletedAt: string | null
}

type ClientMembershipRow = {
  clientId: string | null
  deletedAt: string | null
}

type TaskRow = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: DbTask['status']
  rank: string
  acceptedAt: string | null
  dueOn: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  commentCount: number
  attachmentCount: number
}

type TaskAssigneeRow = {
  taskId: string
  userId: string
  deletedAt: string | null
}

export type ProjectRelationsFetchArgs = {
  projectIds: string[]
  clientIds: string[]
  shouldScopeToUser: boolean
  userId?: string
}

export type ProjectRelationsFetchResult = {
  clients: DbClient[]
  members: MemberWithUser[]
  tasks: RawTaskWithRelations[]
  archivedTasks: RawTaskWithRelations[]
  hourBlocks: RawHourBlock[]
  clientMemberships: ClientMembership[]
}

export async function fetchProjectRelations({
  projectIds,
  clientIds,
  shouldScopeToUser,
  userId,
}: ProjectRelationsFetchArgs): Promise<ProjectRelationsFetchResult> {
  const clientRows: ClientRow[] = clientIds.length
    ? await db
        .select({
          id: clientsTable.id,
          name: clientsTable.name,
          slug: clientsTable.slug,
          notes: clientsTable.notes,
          createdBy: clientsTable.createdBy,
          createdAt: clientsTable.createdAt,
          updatedAt: clientsTable.updatedAt,
          deletedAt: clientsTable.deletedAt,
        })
        .from(clientsTable)
        .where(
          and(
            inArray(clientsTable.id, clientIds),
            isNull(clientsTable.deletedAt),
          ),
        )
    : []

  const memberRows: MemberRow[] = clientIds.length
    ? await db
        .select({
          membership: {
            id: clientMembersTable.id,
            clientId: clientMembersTable.clientId,
            userId: clientMembersTable.userId,
            createdAt: clientMembersTable.createdAt,
            deletedAt: clientMembersTable.deletedAt,
          },
          user: {
            id: usersTable.id,
            email: usersTable.email,
            fullName: usersTable.fullName,
            role: usersTable.role,
            avatarUrl: usersTable.avatarUrl,
            createdAt: usersTable.createdAt,
            updatedAt: usersTable.updatedAt,
            deletedAt: usersTable.deletedAt,
          },
        })
        .from(clientMembersTable)
        .leftJoin(usersTable, eq(clientMembersTable.userId, usersTable.id))
        .where(
          and(
            inArray(clientMembersTable.clientId, clientIds),
            isNull(clientMembersTable.deletedAt),
          ),
        )
    : []

  const hourBlockRows: HourBlockRow[] = clientIds.length
    ? await db
        .select({
          id: hourBlocksTable.id,
          clientId: hourBlocksTable.clientId,
          hoursPurchased: hourBlocksTable.hoursPurchased,
          deletedAt: hourBlocksTable.deletedAt,
        })
        .from(hourBlocksTable)
        .where(
          and(
            inArray(hourBlocksTable.clientId, clientIds),
            isNull(hourBlocksTable.deletedAt),
          ),
        )
    : []

  const clientMembershipRows: ClientMembershipRow[] = shouldScopeToUser && userId
    ? await db
        .select({
          clientId: clientMembersTable.clientId,
          deletedAt: clientMembersTable.deletedAt,
        })
        .from(clientMembersTable)
        .where(
          and(
            eq(clientMembersTable.userId, userId),
            isNull(clientMembersTable.deletedAt),
          ),
        )
    : []

  const taskSelection = {
    id: tasksTable.id,
    projectId: tasksTable.projectId,
    title: tasksTable.title,
    description: tasksTable.description,
    status: tasksTable.status,
    rank: tasksTable.rank,
    acceptedAt: tasksTable.acceptedAt,
    dueOn: tasksTable.dueOn,
    createdBy: tasksTable.createdBy,
    updatedBy: tasksTable.updatedBy,
    createdAt: tasksTable.createdAt,
    updatedAt: tasksTable.updatedAt,
    deletedAt: tasksTable.deletedAt,
    commentCount: sql<number>`
      coalesce(
        (
          select count(*)
          from ${taskCommentsTable}
          where ${taskCommentsTable.taskId} = ${tasksTable.id}
            and ${taskCommentsTable.deletedAt} is null
        ),
        0
      )
    `,
    attachmentCount: sql<number>`
      coalesce(
        (
          select count(*)
          from ${taskAttachmentsTable}
          where ${taskAttachmentsTable.taskId} = ${tasksTable.id}
            and ${taskAttachmentsTable.deletedAt} is null
        ),
        0
      )
    `,
  } satisfies Record<string, unknown>

  const activeTaskRows: TaskRow[] = projectIds.length
    ? await db
        .select(taskSelection)
        .from(tasksTable)
        .where(
          and(
            inArray(tasksTable.projectId, projectIds),
            isNull(tasksTable.deletedAt),
          ),
        )
    : []

  const archivedTaskRows: TaskRow[] = projectIds.length
    ? await db
        .select(taskSelection)
        .from(tasksTable)
        .where(
          and(
            inArray(tasksTable.projectId, projectIds),
            isNotNull(tasksTable.deletedAt),
          ),
        )
    : []

  const allTaskIds = [...activeTaskRows, ...archivedTaskRows].map(row => row.id)

  const assigneeRows: TaskAssigneeRow[] = allTaskIds.length
    ? await db
        .select({
          taskId: taskAssigneesTable.taskId,
          userId: taskAssigneesTable.userId,
          deletedAt: taskAssigneesTable.deletedAt,
        })
        .from(taskAssigneesTable)
        .where(
          and(
            inArray(taskAssigneesTable.taskId, allTaskIds),
            isNull(taskAssigneesTable.deletedAt),
          ),
        )
    : []

  const assigneesByTask = new Map<string, RawTaskWithRelations['assignees']>()
  assigneeRows.forEach(row => {
    const list = assigneesByTask.get(row.taskId) ?? []
    list.push({ user_id: row.userId, deleted_at: row.deletedAt })
    assigneesByTask.set(row.taskId, list)
  })
  const mapTaskRowToRaw = (row: TaskRow): RawTaskWithRelations => ({
    id: row.id,
    project_id: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    rank: row.rank,
    accepted_at: row.acceptedAt,
    due_on: row.dueOn,
    created_by: row.createdBy ?? null,
    updated_by: row.updatedBy ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    assignees: assigneesByTask.get(row.id) ?? [],
    comment_count: Number(row.commentCount ?? 0),
    attachment_count: Number(row.attachmentCount ?? 0),
  })

  const clients: DbClient[] = clientRows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  }))

  const members: MemberWithUser[] = memberRows.map(row => ({
    id: row.membership.id,
    client_id: row.membership.clientId,
    user_id: row.membership.userId,
    created_at: row.membership.createdAt,
    deleted_at: row.membership.deletedAt,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          full_name: row.user.fullName,
          role: row.user.role,
          avatar_url: row.user.avatarUrl,
          created_at: row.user.createdAt,
          updated_at: row.user.updatedAt,
          deleted_at: row.user.deletedAt,
        }
      : null,
  }))

  const hourBlocks: RawHourBlock[] = hourBlockRows.map(row => ({
    id: row.id,
    client_id: row.clientId,
    hours_purchased: Number(row.hoursPurchased ?? 0),
    deleted_at: row.deletedAt,
  }))

  const clientMemberships: ClientMembership[] = clientMembershipRows.map(row => ({
    client_id: row.clientId,
    deleted_at: row.deletedAt,
  }))

  const tasks: RawTaskWithRelations[] = activeTaskRows.map(mapTaskRowToRaw)
  const archivedTasks: RawTaskWithRelations[] =
    archivedTaskRows.map(mapTaskRowToRaw)

  return {
    clients,
    members,
    tasks,
    archivedTasks,
    hourBlocks,
    clientMemberships,
  }
}
