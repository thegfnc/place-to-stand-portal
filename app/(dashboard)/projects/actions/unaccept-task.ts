'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskAcceptanceRevertedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const schema = z.object({
  taskId: z.string().uuid(),
})

export async function unacceptTask(input: {
  taskId: string
}): Promise<ActionResult> {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    return { error: 'Only administrators can modify accepted tasks.' }
  }

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid payload submitted.' }
  }

  const { taskId } = parsed.data

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }

    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to modify this task.' }
    }

    console.error('Failed to authorize task for unaccepting', error)
    return { error: 'Unable to update task acceptance.' }
  }

  const taskRecord = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      acceptedAt: tasks.acceptedAt,
      projectId: tasks.projectId,
      clientId: projects.clientId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const task = taskRecord[0]

  if (!task) {
    return { error: 'Task not found.' }
  }

  if (!task.acceptedAt) {
    return {}
  }

  if (task.status !== 'DONE') {
    return { error: 'Only tasks marked as Done can be unaccepted.' }
  }

  await db
    .update(tasks)
    .set({ acceptedAt: null })
    .where(eq(tasks.id, taskId))

  const event = taskAcceptanceRevertedEvent({ title: task.title ?? 'Task' })

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

  await revalidateProjectTaskViews()

  return {}
}
