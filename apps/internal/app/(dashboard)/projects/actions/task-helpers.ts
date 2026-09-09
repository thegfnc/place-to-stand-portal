import type { SupabaseClient } from '@supabase/supabase-js'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import {
  taskAttachmentsAddedEvent,
  taskAttachmentsRemovedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import {
  taskAttachments,
  taskAssignees,
} from '@/lib/db/schema'
import {
  deleteAttachmentObject,
  moveAttachmentToTaskFolder,
  isPendingAttachmentPath,
} from '@/lib/storage/task-attachments'
import type { Database } from '@/lib/supabase/types'
import type { ActivitySourceValue } from '@/lib/types'

import type { AttachmentPayload } from './shared-schemas'

export async function syncAssignees(taskId: string, assigneeIds: string[]) {
  const deletionTimestamp = new Date().toISOString()

  await db
    .update(taskAssignees)
    .set({ deletedAt: deletionTimestamp })
    .where(eq(taskAssignees.taskId, taskId))

  if (!assigneeIds.length) {
    return
  }

  await db
    .insert(taskAssignees)
    .values(
      assigneeIds.map(userId => ({
        taskId,
        userId,
        deletedAt: null,
      }))
    )
    .onConflictDoUpdate({
      target: [taskAssignees.taskId, taskAssignees.userId],
      set: { deletedAt: null },
    })
}

/**
 * Where attachment activity is recorded. Uploads are staged into a pending
 * folder before the task is saved, so the upload route sees files that may
 * never be attached; this sync is the one place that knows what actually
 * landed on (or left) the task.
 */
export type AttachmentActivityContext = {
  taskTitle: string
  projectId: string
  clientId: string | null
  source: ActivitySourceValue
}

export async function syncAttachments({
  storage,
  taskId,
  actorId,
  actorRole,
  attachmentsInput,
  activity,
}: {
  storage: SupabaseClient<Database>
  taskId: string
  actorId: string
  actorRole: Database['public']['Enums']['user_role']
  attachmentsInput?: AttachmentPayload
  activity: AttachmentActivityContext
}) {
  if (!attachmentsInput) {
    return
  }

  const { toAttach, toRemove } = attachmentsInput

  if (!toAttach.length && !toRemove.length) {
    return
  }

  if (toAttach.length) {
    const rows =
      [] as Database['public']['Tables']['task_attachments']['Insert'][]

    for (const attachment of toAttach) {
      if (
        actorRole !== 'ADMIN' &&
        !isPendingAttachmentPath(attachment.path, actorId)
      ) {
        continue
      }

      const destination = await moveAttachmentToTaskFolder({
        client: storage,
        path: attachment.path,
        taskId,
      })

      if (!destination) {
        continue
      }

      rows.push({
        task_id: taskId,
        storage_path: destination,
        original_name: attachment.originalName,
        mime_type: attachment.mimeType,
        file_size: attachment.fileSize,
        uploaded_by: actorId,
      })
    }

    if (rows.length) {
      await db.insert(taskAttachments).values(
        rows.map(row => ({
          taskId: row.task_id,
          storagePath: row.storage_path,
          originalName: row.original_name,
          mimeType: row.mime_type,
          fileSize: row.file_size,
          uploadedBy: row.uploaded_by,
        }))
      )

      await logAttachmentActivity({
        taskId,
        actorId,
        actorRole,
        activity,
        event: taskAttachmentsAddedEvent({
          taskTitle: activity.taskTitle,
          fileNames: rows.map(row => row.original_name),
        }),
      })
    }
  }

  if (toRemove.length) {
    const existing = await db
      .select({
        id: taskAttachments.id,
        storagePath: taskAttachments.storagePath,
        originalName: taskAttachments.originalName,
      })
      .from(taskAttachments)
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          inArray(taskAttachments.id, toRemove),
          isNull(taskAttachments.deletedAt)
        )
      )

    const idsToRemove = existing.map(attachment => attachment.id)

    if (idsToRemove.length) {
      const timestamp = new Date().toISOString()

      await db
        .update(taskAttachments)
        .set({ deletedAt: timestamp })
        .where(inArray(taskAttachments.id, idsToRemove))

      await Promise.all(
        existing.map(async attachment => {
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

      await logAttachmentActivity({
        taskId,
        actorId,
        actorRole,
        activity,
        event: taskAttachmentsRemovedEvent({
          taskTitle: activity.taskTitle,
          fileNames: existing.map(attachment => attachment.originalName),
        }),
      })
    }
  }
}

async function logAttachmentActivity({
  taskId,
  actorId,
  actorRole,
  activity,
  event,
}: {
  taskId: string
  actorId: string
  actorRole: Database['public']['Enums']['user_role']
  activity: AttachmentActivityContext
  event: ReturnType<typeof taskAttachmentsAddedEvent>
}) {
  await logActivity({
    actorId,
    actorRole,
    source: activity.source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: activity.projectId,
    targetClientId: activity.clientId,
    metadata: event.metadata,
  })
}
