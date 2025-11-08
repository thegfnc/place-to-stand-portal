'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskUpdatedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const dueOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()

export async function changeTaskDueDate(input: {
  taskId: string
  dueOn: string | null
}): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = z
    .object({
      taskId: z.string().uuid(),
      dueOn: dueOnSchema,
    })
    .safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid due date update payload.' }
  }

  const { taskId, dueOn } = parsed.data

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }

    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to update this task.' }
    }

    console.error('Failed to authorize task for due date change', error)
    return { error: 'Unable to update task due date.' }
  }

  const taskRecords = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueOn: tasks.dueOn,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  const task = taskRecords[0]

  if (!task) {
    return { error: 'Task not found.' }
  }

  const previousDueOn = task.dueOn ?? null
  const nextDueOn = dueOn ?? null

  if (previousDueOn === nextDueOn) {
    return {}
  }

  await db
    .update(tasks)
    .set({ dueOn: nextDueOn })
    .where(eq(tasks.id, taskId))

  const event = taskUpdatedEvent({
    title: task.title ?? 'Task',
    changedFields: ['due date'],
    details: {
      dueOn: {
        from: previousDueOn,
        to: nextDueOn,
      },
    },
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: task.projectId,
    targetClientId: null,
    metadata: event.metadata,
  })

  await revalidateProjectTaskViews()

  return {}
}
