'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskStatusChangedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'

import { revalidateProjectTaskViews } from './shared'
import { statusSchema, TASK_STATUSES } from './shared-schemas'
import type { ActionResult } from './action-types'
import { resolveNextTaskRank } from './task-rank'

export async function changeTaskStatus(input: {
  taskId: string
  status: (typeof TASK_STATUSES)[number]
}): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = z
    .object({
      taskId: z.string().uuid(),
      status: statusSchema,
    })
    .safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid status update payload.' }
  }

  const { taskId, status } = parsed.data

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }

    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to update this task.' }
    }

    console.error('Failed to authorize task for status change', error)
    return { error: 'Unable to update task status.' }
  }

  const taskRecord = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      projectId: tasks.projectId,
      clientId: projects.clientId,
      deletedAt: tasks.deletedAt,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const task = taskRecord[0]

  if (!task) {
    return { error: 'Task not found.' }
  }

  if (task.deletedAt) {
    return { error: 'Archived tasks cannot be updated.' }
  }

  if (task.status !== status) {
    let nextRank: string

    try {
      nextRank = await resolveNextTaskRank(task.projectId, status)
    } catch (rankError) {
      console.error('Failed to resolve rank for task status change', rankError)
      return { error: 'Unable to update task ordering.' }
    }

    await db
      .update(tasks)
      .set({
        status,
        rank: nextRank,
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId))

    const event = taskStatusChangedEvent({
      title: task.title ?? 'Task',
      fromStatus: task.status,
      toStatus: status,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'TASK',
      targetId: taskId,
      targetProjectId: task.projectId,
      targetClientId: task.clientId ?? null,
      metadata: event.metadata,
    })
  }

  await revalidateProjectTaskViews()

  return {}
}
