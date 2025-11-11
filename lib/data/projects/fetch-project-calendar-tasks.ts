import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  taskAssignees as taskAssigneesTable,
  tasks as tasksTable,
} from '@/lib/db/schema'
import { normalizeRawTask } from './normalize-task'
import type { RawTaskWithRelations } from './types'
import type { DbTask, TaskWithRelations } from '@/lib/types'

type TaskRow = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: DbTask['status']
  acceptedAt: string | null
  dueOn: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  rank: string
}

type TaskAssigneeRow = {
  taskId: string
  userId: string
  deletedAt: string | null
}

type FetchProjectCalendarTasksArgs = {
  projectId: string
  start: string
  end: string
}

export async function fetchProjectCalendarTasks({
  projectId,
  start,
  end,
}: FetchProjectCalendarTasksArgs): Promise<TaskWithRelations[]> {
  const taskRows: TaskRow[] = await db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      acceptedAt: tasksTable.acceptedAt,
      dueOn: tasksTable.dueOn,
      createdBy: tasksTable.createdBy,
      updatedBy: tasksTable.updatedBy,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      deletedAt: tasksTable.deletedAt,
      rank: tasksTable.rank,
    })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.projectId, projectId),
        isNull(tasksTable.deletedAt),
        gte(tasksTable.dueOn, start),
        lte(tasksTable.dueOn, end),
      ),
    )
    .orderBy(asc(tasksTable.dueOn), asc(tasksTable.title))

  const taskIds = taskRows.map(row => row.id)

  const assigneeRows: TaskAssigneeRow[] = taskIds.length
    ? await db
        .select({
          taskId: taskAssigneesTable.taskId,
          userId: taskAssigneesTable.userId,
          deletedAt: taskAssigneesTable.deletedAt,
        })
        .from(taskAssigneesTable)
        .where(
          and(
            inArray(taskAssigneesTable.taskId, taskIds),
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

  const rawTasks: RawTaskWithRelations[] = taskRows.map(row => ({
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
    comment_count: 0,
    attachment_count: 0,
  }))

  const normalized = rawTasks
    .filter(task => Boolean(task?.due_on))
    .map(task => normalizeRawTask(task))
    .filter(task => !(task.status === 'DONE' && task.accepted_at))

  normalized.sort((a, b) => {
    const dueA = a.due_on ?? ''
    const dueB = b.due_on ?? ''

    if (dueA !== dueB) {
      return dueA.localeCompare(dueB)
    }

    return a.title.localeCompare(b.title)
  })

  return normalized
}
