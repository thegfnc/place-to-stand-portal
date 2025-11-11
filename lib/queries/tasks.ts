import 'server-only'

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureClientAccessByProjectId,
  ensureClientAccessByTaskId,
  isAdmin,
  listAccessibleTaskIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clients,
  projects,
  taskAssignees,
  taskAttachments,
  taskComments,
  tasks,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { RawTaskWithRelations } from '@/lib/data/projects/types'

type SelectTask = typeof tasks.$inferSelect

const taskFields = {
  id: tasks.id,
  projectId: tasks.projectId,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  dueOn: tasks.dueOn,
  createdBy: tasks.createdBy,
  updatedBy: tasks.updatedBy,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  deletedAt: tasks.deletedAt,
  acceptedAt: tasks.acceptedAt,
  rank: tasks.rank,
}

export async function listTasksForProject(
  user: AppUser,
  projectId: string,
): Promise<SelectTask[]> {
  await ensureClientAccessByProjectId(user, projectId)

  return db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.rank))
}

export async function listTasksForUser(
  user: AppUser,
): Promise<SelectTask[]> {
  if (isAdmin(user)) {
    return db
      .select(taskFields)
      .from(tasks)
      .where(isNull(tasks.deletedAt))
      .orderBy(asc(tasks.rank))
  }

  const taskIds = await listAccessibleTaskIds(user)

  if (!taskIds.length) {
    return []
  }

  return db
    .select(taskFields)
    .from(tasks)
    .where(
      and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt)),
    )
    .orderBy(asc(tasks.rank))
}

export async function getTaskById(
  user: AppUser,
  taskId: string,
): Promise<SelectTask> {
  await ensureClientAccessByTaskId(user, taskId)

  const result = await db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Task not found')
  }

  return result[0]
}

type TaskWithRelationsSelection = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: SelectTask['status']
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
      and(
        inArray(taskAssignees.taskId, taskIds),
        isNull(taskAssignees.deletedAt),
      ),
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

export type ProjectTaskCollections = {
  active: RawTaskWithRelations[]
  accepted: RawTaskWithRelations[]
  archived: RawTaskWithRelations[]
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

type TaskSummarySelection = {
  task: {
    id: string
    title: string
    status: SelectTask['status']
    dueOn: string | null
    updatedAt: string
    createdAt: string
    deletedAt: string | null
    projectId: string
  }
  project: {
    id: string
    name: string | null
    slug: string | null
    clientId: string | null
  } | null
  client: {
    id: string
    name: string | null
    slug: string | null
  } | null
}

type TaskSummaryAssignee = {
  userId: string
  deletedAt: string | null
}

export type TaskSummaryRow = {
  id: string
  title: string
  status: string | null
  due_on: string | null
  updated_at: string | null
  created_at: string | null
  deleted_at: string | null
  project_id: string
  project: {
    id: string
    name: string | null
    slug: string | null
    client?: {
      id: string
      name: string | null
      slug: string | null
    } | null
  } | null
  assignees: Array<{ user_id: string; deleted_at: string | null }> | null
}

export async function getTaskSummaryForUser(
  user: AppUser,
  taskId: string,
): Promise<TaskSummaryRow | null> {
  await ensureClientAccessByTaskId(user, taskId)

  const rows = (await db
    .select({
      task: {
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        dueOn: tasks.dueOn,
        updatedAt: tasks.updatedAt,
        createdAt: tasks.createdAt,
        deletedAt: tasks.deletedAt,
        projectId: tasks.projectId,
      },
      project: {
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        clientId: projects.clientId,
      },
      client: {
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
      },
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(tasks.id, taskId))
    .limit(1)) as TaskSummarySelection[]

  if (!rows.length) {
    return null
  }

  const [selection] = rows

  const assignees = (await db
    .select({
      userId: taskAssignees.userId,
      deletedAt: taskAssignees.deletedAt,
    })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId))) as TaskSummaryAssignee[]

  return {
    id: selection.task.id,
    title: selection.task.title ?? '',
    status: selection.task.status ?? null,
    due_on: selection.task.dueOn ?? null,
    updated_at: selection.task.updatedAt ?? null,
    created_at: selection.task.createdAt ?? null,
    deleted_at: selection.task.deletedAt ?? null,
    project_id: selection.task.projectId,
    project: selection.project
      ? {
          id: selection.project.id,
          name: selection.project.name,
          slug: selection.project.slug,
          client: selection.client
            ? {
                id: selection.client.id,
                name: selection.client.name,
                slug: selection.client.slug,
              }
            : null,
        }
      : null,
    assignees: assignees.map(row => ({
      user_id: row.userId,
      deleted_at: row.deletedAt,
    })),
  }
}

