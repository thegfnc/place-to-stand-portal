import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  taskAssignees as taskAssigneesTable,
  taskAttachments as taskAttachmentsTable,
  taskComments as taskCommentsTable,
  tasks as tasksTable,
} from '@/lib/db/schema'
import { normalizeRawTask } from './normalize-task'
import type { RawTaskAttachment, RawTaskRelation, RawTaskWithRelations } from './types'
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
    comments: commentsByTask.get(row.id) ?? [],
    attachments: attachmentsByTask.get(row.id) ?? [],
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
