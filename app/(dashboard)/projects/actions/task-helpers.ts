import type { SupabaseClient } from '@supabase/supabase-js'

import {
  deleteAttachmentObject,
  moveAttachmentToTaskFolder,
  isPendingAttachmentPath,
} from '@/lib/storage/task-attachments'
import type { Database } from '@/supabase/types/database'

import type { AttachmentPayload } from './shared'

export async function syncAssignees(
  supabase: SupabaseClient<Database>,
  taskId: string,
  assigneeIds: string[]
) {
  const deletionTimestamp = new Date().toISOString()

  const { error: removeError } = await supabase
    .from('task_assignees')
    .update({ deleted_at: deletionTimestamp })
    .eq('task_id', taskId)

  if (removeError) {
    console.error('Failed to archive existing task assignees', removeError)
    throw removeError
  }

  if (!assigneeIds.length) {
    return
  }

  const { error: upsertError } = await supabase.from('task_assignees').upsert(
    assigneeIds.map(userId => ({
      task_id: taskId,
      user_id: userId,
      deleted_at: null,
    })),
    { onConflict: 'task_id,user_id' }
  )

  if (upsertError) {
    console.error('Failed to upsert task assignees', upsertError)
    throw upsertError
  }
}

export async function syncAttachments({
  supabase,
  storage,
  taskId,
  actorId,
  actorRole,
  attachmentsInput,
}: {
  supabase: SupabaseClient<Database>
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
      const { error } = await supabase.from('task_attachments').insert(rows)

      if (error) {
        console.error('Failed to attach files to task', error)
        throw error
      }
    }
  }

  if (toRemove.length) {
    const { data: existing, error } = await supabase
      .from('task_attachments')
      .select('id, storage_path')
      .in('id', toRemove)
      .eq('task_id', taskId)
      .is('deleted_at', null)

    if (error) {
      console.error('Failed to load attachments for removal', error)
      throw error
    }

    const idsToRemove = (existing ?? []).map(attachment => attachment.id)

    if (idsToRemove.length) {
      const timestamp = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('task_attachments')
        .update({ deleted_at: timestamp })
        .in('id', idsToRemove)

      if (updateError) {
        console.error('Failed to mark attachments as removed', updateError)
        throw updateError
      }

      await Promise.all(
        (existing ?? []).map(async attachment => {
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
  }
}
