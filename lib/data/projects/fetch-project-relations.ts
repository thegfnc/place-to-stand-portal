import { and, eq, inArray, isNull } from 'drizzle-orm'

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
import type { DbClient, DbTask, DbTimeLog, DbUser } from '@/lib/types'
import { getTimeLogsForProjects } from '@/lib/queries/time-logs'

import type {
  ClientMembership,
  MemberWithUser,
  RawHourBlock,
  RawTaskAttachment,
  RawTaskRelation,
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
}

type TaskAssigneeRow = {
  taskId: string
  userId: string
  deletedAt: string | null
}

type TaskCommentRow = {
  id: string
  taskId: string
  deletedAt: string | null
}

type TaskAttachmentRow = {
  id: string
  taskId: string
  storagePath: string
  originalName: string
  mimeType: string
  fileSize: number
  uploadedBy: string
  createdAt: string
  updatedAt: string
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
  hourBlocks: RawHourBlock[]
  timeLogs: DbTimeLog[]
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
        .where(inArray(clientsTable.id, clientIds))
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
        .where(inArray(clientMembersTable.clientId, clientIds))
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
        .where(inArray(hourBlocksTable.clientId, clientIds))
    : []

  const clientMembershipRows: ClientMembershipRow[] = shouldScopeToUser && userId
    ? await db
        .select({
          clientId: clientMembersTable.clientId,
          deletedAt: clientMembersTable.deletedAt,
        })
        .from(clientMembersTable)
        .where(eq(clientMembersTable.userId, userId))
    : []

  const timeLogs: DbTimeLog[] = projectIds.length
    ? await getTimeLogsForProjects(projectIds)
    : []

  const taskRows: TaskRow[] = projectIds.length
    ? await db
        .select({
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
        })
        .from(tasksTable)
        .where(
          and(
            inArray(tasksTable.projectId, projectIds),
            isNull(tasksTable.deletedAt),
          ),
        )
    : []

  const taskIds = taskRows.map(row => row.id)

  const [assigneeRows, commentRows, attachmentRows]: [
    TaskAssigneeRow[],
    TaskCommentRow[],
    TaskAttachmentRow[],
  ] = taskIds.length
    ? await Promise.all([
        db
          .select({
            taskId: taskAssigneesTable.taskId,
            userId: taskAssigneesTable.userId,
            deletedAt: taskAssigneesTable.deletedAt,
          })
          .from(taskAssigneesTable)
          .where(inArray(taskAssigneesTable.taskId, taskIds)),
        db
          .select({
            id: taskCommentsTable.id,
            taskId: taskCommentsTable.taskId,
            deletedAt: taskCommentsTable.deletedAt,
          })
          .from(taskCommentsTable)
          .where(inArray(taskCommentsTable.taskId, taskIds)),
        db
          .select({
            id: taskAttachmentsTable.id,
            taskId: taskAttachmentsTable.taskId,
            storagePath: taskAttachmentsTable.storagePath,
            originalName: taskAttachmentsTable.originalName,
            mimeType: taskAttachmentsTable.mimeType,
            fileSize: taskAttachmentsTable.fileSize,
            uploadedBy: taskAttachmentsTable.uploadedBy,
            createdAt: taskAttachmentsTable.createdAt,
            updatedAt: taskAttachmentsTable.updatedAt,
            deletedAt: taskAttachmentsTable.deletedAt,
          })
          .from(taskAttachmentsTable)
          .where(inArray(taskAttachmentsTable.taskId, taskIds)),
      ])
    : [[], [], []]

  const assigneesByTask = new Map<string, RawTaskWithRelations['assignees']>()
  assigneeRows.forEach(row => {
    const list = assigneesByTask.get(row.taskId) ?? []
    list.push({ user_id: row.userId, deleted_at: row.deletedAt })
    assigneesByTask.set(row.taskId, list)
  })

  const commentsByTask = new Map<string, RawTaskRelation[]>()
  commentRows.forEach(row => {
    const list = commentsByTask.get(row.taskId) ?? []
    list.push({ id: row.id, deleted_at: row.deletedAt })
    commentsByTask.set(row.taskId, list)
  })

  const attachmentsByTask = new Map<string, RawTaskAttachment[]>()
  attachmentRows.forEach(row => {
    const list = attachmentsByTask.get(row.taskId) ?? []
    list.push({
      id: row.id,
      task_id: row.taskId,
      storage_path: row.storagePath,
      original_name: row.originalName,
      mime_type: row.mimeType,
      file_size: Number(row.fileSize ?? 0),
      uploaded_by: row.uploadedBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt,
    })
    attachmentsByTask.set(row.taskId, list)
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

  const tasks: RawTaskWithRelations[] = taskRows.map(row => ({
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
    comments: commentsByTask.get(row.id) ?? [],
    attachments: attachmentsByTask.get(row.id) ?? [],
  }))

  return {
    clients,
    members,
    tasks,
    hourBlocks,
    timeLogs,
    clientMemberships,
  }
}
