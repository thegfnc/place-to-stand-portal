import 'server-only'

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { ensureClientAccessByProjectId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  taskAssignees,
  taskAttachments,
  taskComments,
  tasks,
} from '@/lib/db/schema'
import type { RawTaskWithRelations } from '@/lib/data/projects/types'

type TaskWithRelationsSelection = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: RawTaskWithRelations['status']
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

type TaskAssigneeSelection = {
  taskId: string
  userId: string
  deletedAt: string | null
}

export type ProjectTaskCollections = {
  active: RawTaskWithRelations[]
  accepted: RawTaskWithRelations[]
  archived: RawTaskWithRelations[]
}

export async function listProjectTasksWithRelations(
  user: AppUser,
  projectId: string,
  options: { includeArchived?: boolean } = {},
): Promise<RawTaskWithRelations[]> {
  await ensureClientAccessByProjectId(user, projectId)

  const whereClause = options.includeArchived
    ? eq(tasks.projectId, projectId)
    : and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt))

  const taskRows = (await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      rank: tasks.rank,
      acceptedAt: tasks.acceptedAt,
      dueOn: tasks.dueOn,
      createdBy: tasks.createdBy,
      updatedBy: tasks.updatedBy,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      deletedAt: tasks.deletedAt,
      commentCount: sql<number>`
        coalesce(
          (
            select count(*)
            from ${taskComments}
            where ${taskComments.taskId} = ${tasks.id}
              and ${taskComments.deletedAt} is null
          ),
          0
        )
      `,
      attachmentCount: sql<number>`
        coalesce(
          (
            select count(*)
            from ${taskAttachments}
            where ${taskAttachments.taskId} = ${tasks.id}
              and ${taskAttachments.deletedAt} is null
          ),
          0
        )
      `,
    })
    .from(tasks)
    .where(whereClause)
    .orderBy(asc(tasks.rank))) as TaskWithRelationsSelection[]

  if (!taskRows.length) {
    return []
  }

  const taskIds = taskRows.map(row => row.id)

  const assigneeRows = (await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
      deletedAt: taskAssignees.deletedAt,
    })
    .from(taskAssignees)
    .where(
      and(inArray(taskAssignees.taskId, taskIds), isNull(taskAssignees.deletedAt)),
    )) as TaskAssigneeSelection[]

  const assigneesByTask = new Map<string, RawTaskWithRelations['assignees']>()
  assigneeRows.forEach(row => {
    const list = assigneesByTask.get(row.taskId) ?? []
    list.push({ user_id: row.userId, deleted_at: row.deletedAt })
    assigneesByTask.set(row.taskId, list)
  })

  return taskRows.map(row => ({
    id: row.id,
    project_id: row.projectId,
    title: row.title ?? '',
    description: row.description,
    status: row.status ?? 'BACKLOG',
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
  }))
}

export async function listProjectTaskCollectionsWithRelations(
  user: AppUser,
  projectId: string,
): Promise<ProjectTaskCollections> {
  const rows = await listProjectTasksWithRelations(user, projectId, {
    includeArchived: true,
  })

  const active = rows.filter(task => !task.deleted_at)
  const archived = rows
    .filter(task => Boolean(task.deleted_at))
    .sort((a, b) => {
      const aTime = a.deleted_at ? Date.parse(a.deleted_at) : 0
      const bTime = b.deleted_at ? Date.parse(b.deleted_at) : 0
      return bTime - aTime
    })

  const accepted = active
    .filter(task => task.status === 'DONE' && Boolean(task.accepted_at))
    .sort((a, b) => {
      const aTime = a.accepted_at ? Date.parse(a.accepted_at) : 0
      const bTime = b.accepted_at ? Date.parse(b.accepted_at) : 0
      return bTime - aTime
    })

  return {
    active,
    accepted,
    archived,
  }
}

