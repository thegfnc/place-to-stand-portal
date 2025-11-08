'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskArchivedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, taskAttachments, tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { deleteAttachmentObject } from '@/lib/storage/task-attachments'
import type { Json } from '@/supabase/types/database'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

export async function removeTask(input: {
  taskId: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = z
    .object({
      taskId: z.string().uuid(),
    })
    .safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete payload.' }
  }

  const { taskId } = parsed.data

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }

    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to archive this task.' }
    }

    console.error('Failed to authorize task for deletion', error)
    return { error: 'Unable to archive task.' }
  }

  const taskRecord = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      projectId: tasks.projectId,
      clientId: projects.clientId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const existingTask = taskRecord[0]

  if (!existingTask) {
    return { error: 'Task not found.' }
  }

  const timestamp = new Date().toISOString()

  await db
    .update(tasks)
    .set({ deletedAt: timestamp })
    .where(eq(tasks.id, taskId))

  const attachmentRows = await db
    .select({
      id: taskAttachments.id,
      storagePath: taskAttachments.storagePath,
    })
    .from(taskAttachments)
    .where(
      and(
        eq(taskAttachments.taskId, taskId),
        isNull(taskAttachments.deletedAt)
      )
    )

  if (attachmentRows.length) {
    await db
      .update(taskAttachments)
      .set({ deletedAt: timestamp })
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          isNull(taskAttachments.deletedAt)
        )
      )

    const storage = getSupabaseServiceClient()

    await Promise.all(
      attachmentRows.map(async attachment => {
        try {
          await deleteAttachmentObject({
            client: storage,
            path: attachment.storagePath,
          })
        } catch (storageError) {
          console.error('Failed to delete attachment object', storageError)
        }
      })
    )
  }

  const event = taskArchivedEvent({ title: existingTask.title ?? 'Task' })

  const attachmentsRemoved = attachmentRows.map(attachment => attachment.id)

  const archiveMetadata: Json =
    event.metadata &&
    typeof event.metadata === 'object' &&
    event.metadata !== null &&
    !Array.isArray(event.metadata)
      ? (JSON.parse(
          JSON.stringify({
            ...(event.metadata as Record<string, unknown>),
            attachmentsRemoved,
          })
        ) as Json)
      : (JSON.parse(JSON.stringify({ attachmentsRemoved })) as Json)

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: existingTask.projectId,
    targetClientId: existingTask.clientId ?? null,
    metadata: archiveMetadata,
  })

  await revalidateProjectTaskViews()

  return {}
}
