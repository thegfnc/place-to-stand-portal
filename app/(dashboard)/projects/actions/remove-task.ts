'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskArchivedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { deleteAttachmentObject } from '@/lib/storage/task-attachments'
import type { Json } from '@/supabase/types/database'

import type { ActionResult } from './shared'

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

  const supabase = getSupabaseServerClient()
  const storage = getSupabaseServiceClient()
  const { taskId } = parsed.data

  const { data: existingTask, error: existingTaskError } = await supabase
    .from('tasks')
    .select(
      `
        id,
        title,
        project_id,
        project:projects (
          client_id
        )
      `
    )
    .eq('id', taskId)
    .maybeSingle()

  if (existingTaskError) {
    console.error('Failed to load task for deletion', existingTaskError)
    return { error: 'Unable to archive task.' }
  }

  if (!existingTask) {
    return { error: 'Task not found.' }
  }

  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) {
    console.error('Failed to soft delete task', error)
    return { error: error.message }
  }

  const { data: attachmentRows, error: attachmentsError } = await supabase
    .from('task_attachments')
    .select('id, storage_path')
    .eq('task_id', taskId)
    .is('deleted_at', null)

  if (!attachmentsError && attachmentRows?.length) {
    const timestamp = new Date().toISOString()

    const { error: markDeletedError } = await supabase
      .from('task_attachments')
      .update({ deleted_at: timestamp })
      .eq('task_id', taskId)
      .is('deleted_at', null)

    if (markDeletedError) {
      console.error('Failed to mark attachments deleted', markDeletedError)
    }

    await Promise.all(
      attachmentRows.map(async attachment => {
        try {
          await deleteAttachmentObject({
            client: storage,
            path: attachment.storage_path,
          })
        } catch (storageError) {
          console.error('Failed to delete attachment object', storageError)
        }
      })
    )
  }

  const event = taskArchivedEvent({ title: existingTask.title })

  const attachmentsRemoved = (attachmentRows ?? []).map(
    attachment => attachment.id
  )

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
    targetProjectId: existingTask.project_id,
    targetClientId: existingTask.project?.client_id ?? null,
    metadata: archiveMetadata,
  })

  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}
