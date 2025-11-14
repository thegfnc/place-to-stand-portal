import 'server-only'

import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clients,
  projects,
  taskAssignees,
  tasks,
} from '@/lib/db/schema'

type TaskSummarySelection = {
  task: {
    id: string
    title: string
    status: string | null
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
