import type { SupabaseClient } from '@supabase/supabase-js'
import { and, eq, inArray, isNull } from 'drizzle-orm'

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
import type { Database } from '@/supabase/types/database'

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

export async function syncAttachments({
  storage,
  taskId,
  actorId,
  actorRole,
  attachmentsInput,
}: {
  storage: SupabaseClient<Database>
  taskId: string
  actorId: string
  actorRole: Database['public']['Enums']['user_role']
  attachmentsInput?: AttachmentPayload
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
    }
  }

  if (toRemove.length) {
    const existing = await db
      .select({
        id: taskAttachments.id,
        storagePath: taskAttachments.storagePath,
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
    }
  }
}
