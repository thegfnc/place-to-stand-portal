import 'server-only'

import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import {
  taskCommentCreatedEvent,
  taskCommentDeletedEvent,
  taskCommentUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { ensureTaskAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, taskComments, tasks, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
} from '@/lib/pagination/cursor'
import type {
  ActivitySourceValue,
  TaskCommentAuthor,
  TaskCommentWithAuthor,
} from '@/lib/types'

/**
 * Comment mutations are reached from the browser API routes and from the CLI;
 * the activity row is written here so neither caller has to remember it, and
 * only the source differs between them.
 */
export type TaskCommentMutationOptions = {
  source?: ActivitySourceValue
}

type CommentSelection = {
  id: string
  taskId: string
  authorId: string
  body: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  author: {
    id: string
    fullName: string | null
    email: string | null
    avatarUrl: string | null
  } | null
}

function mapUserToCommentAuthor(
  user: CommentSelection['author']
): TaskCommentAuthor | null {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    full_name: user.fullName ?? null,
    email: user.email ?? null,
    avatar_url: user.avatarUrl ?? null,
  }
}

function mapCommentSelectionToTaskComment(
  selection: CommentSelection,
): TaskCommentWithAuthor {
  return {
    id: selection.id,
    task_id: selection.taskId,
    author_id: selection.authorId,
    body: selection.body,
    created_at: selection.createdAt,
    updated_at: selection.updatedAt,
    deleted_at: selection.deletedAt,
    author: mapUserToCommentAuthor(selection.author),
  }
}

async function getCommentSelectionById(commentId: string): Promise<CommentSelection | null> {
  const rows = await db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      authorId: taskComments.authorId,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
      deletedAt: taskComments.deletedAt,
      author: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(taskComments)
    .leftJoin(users, eq(users.id, taskComments.authorId))
    .where(and(eq(taskComments.id, commentId), isNull(taskComments.deletedAt)))
    .limit(1)

  return rows[0] ?? null
}

type CommentTaskContext = {
  title: string
  projectId: string
  clientId: string | null
}

async function getCommentTaskContext(
  taskId: string
): Promise<CommentTaskContext | null> {
  const rows = await db
    .select({
      title: tasks.title,
      projectId: tasks.projectId,
      clientId: projects.clientId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const row = rows[0]

  return row
    ? { title: row.title, projectId: row.projectId, clientId: row.clientId ?? null }
    : null
}

async function logCommentActivity(args: {
  user: AppUser
  source?: ActivitySourceValue
  taskId: string
  commentId: string
  buildEvent: typeof taskCommentCreatedEvent
}): Promise<void> {
  const context = await getCommentTaskContext(args.taskId)
  const event = args.buildEvent({ taskTitle: context?.title ?? null })

  await logActivity({
    actorId: args.user.id,
    actorRole: args.user.role,
    source: args.source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'COMMENT',
    targetId: args.commentId,
    targetProjectId: context?.projectId ?? null,
    targetClientId: context?.clientId ?? null,
    metadata: { taskId: args.taskId, commentId: args.commentId },
  })
}

export type ListTaskCommentsInput = {
  limit?: number | null
  cursor?: string | null
}

export type TaskCommentsPage = {
  items: TaskCommentWithAuthor[]
  pageInfo: {
    hasNextPage: boolean
    nextCursor: string | null
  }
}

function buildTaskCommentsCursorCondition(
  cursor: { createdAt?: string | null; id?: string | null } | null,
): SQL | null {
  if (!cursor) {
    return null
  }

  const createdAt = cursor.createdAt ?? null
  const idValue = typeof cursor.id === 'string' ? cursor.id : ''

  if (!createdAt || !idValue) {
    return null
  }

  return sql`${taskComments.createdAt} < ${createdAt} OR (${taskComments.createdAt} = ${createdAt} AND ${taskComments.id} < ${idValue})`
}

export async function listTaskComments(
  user: AppUser,
  taskId: string,
  input: ListTaskCommentsInput = {},
): Promise<TaskCommentsPage> {
  await ensureTaskAccess(user, taskId)

  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const cursorPayload = decodeCursor<{ createdAt?: string; id?: string }>(
    input.cursor,
  )
  const cursorCondition = buildTaskCommentsCursorCondition(cursorPayload)

  const baseConditions: SQL[] = [
    eq(taskComments.taskId, taskId),
    isNull(taskComments.deletedAt),
  ]

  const whereClause =
    cursorCondition !== null
      ? and(...baseConditions, cursorCondition)
      : and(...baseConditions)

  const rows = (await db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      authorId: taskComments.authorId,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
      deletedAt: taskComments.deletedAt,
      author: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(taskComments)
    .leftJoin(users, eq(users.id, taskComments.authorId))
    .where(whereClause)
    .orderBy(desc(taskComments.createdAt), desc(taskComments.id))
    .limit(limit + 1)) as CommentSelection[]

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows

  const items = slicedRows.map(mapCommentSelectionToTaskComment)
  const lastItem = items[items.length - 1] ?? null

  return {
    items,
    pageInfo: {
      hasNextPage: hasExtraRecord,
      nextCursor: lastItem
        ? encodeCursor({
            createdAt: lastItem.created_at,
            id: lastItem.id,
          })
        : null,
    },
  }
}

export async function createTaskComment(
  user: AppUser,
  input: {
    taskId: string
    body: string
  },
  options: TaskCommentMutationOptions = {},
): Promise<{ commentId: string }> {
  await ensureTaskAccess(user, input.taskId)

  const result = await db
    .insert(taskComments)
    .values({
      taskId: input.taskId,
      authorId: user.id,
      body: input.body,
    })
    .returning({ id: taskComments.id })

  const comment = result[0]

  if (!comment) {
    throw new NotFoundError('Failed to create comment.')
  }

  await logCommentActivity({
    user,
    source: options.source,
    taskId: input.taskId,
    commentId: comment.id,
    buildEvent: taskCommentCreatedEvent,
  })

  return { commentId: comment.id }
}

export async function updateTaskComment(
  user: AppUser,
  input: {
    commentId: string
    body: string
  },
  options: TaskCommentMutationOptions = {},
): Promise<void> {
  const comment = await getCommentSelectionById(input.commentId)

  if (!comment) {
    throw new NotFoundError('Task comment not found')
  }

  await ensureTaskAccess(user, comment.taskId)

  // Re-saving an unchanged body is a no-op: no write, no activity row.
  if (comment.body === input.body) {
    return
  }

  await db
    .update(taskComments)
    .set({
      body: input.body,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(taskComments.id, input.commentId))

  await logCommentActivity({
    user,
    source: options.source,
    taskId: comment.taskId,
    commentId: input.commentId,
    buildEvent: taskCommentUpdatedEvent,
  })
}

export async function softDeleteTaskComment(
  user: AppUser,
  commentId: string,
  options: TaskCommentMutationOptions = {},
): Promise<void> {
  const comment = await getCommentSelectionById(commentId)

  if (!comment) {
    throw new NotFoundError('Task comment not found')
  }

  await ensureTaskAccess(user, comment.taskId)

  const now = new Date().toISOString()

  await db
    .update(taskComments)
    .set({
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(taskComments.id, commentId))

  await logCommentActivity({
    user,
    source: options.source,
    taskId: comment.taskId,
    commentId,
    buildEvent: taskCommentDeletedEvent,
  })
}
