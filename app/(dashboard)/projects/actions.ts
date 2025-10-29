'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { SupabaseClient } from '@supabase/supabase-js'

import { requireUser } from '@/lib/auth/session'
import type { Database } from '@/supabase/types/database'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  ensureTaskAttachmentBucket,
  moveAttachmentToTaskFolder,
  deleteAttachmentObject,
  isPendingAttachmentPath,
} from '@/lib/storage/task-attachments'

const TASK_STATUSES = [
  'BACKLOG',
  'ON_DECK',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'ARCHIVED',
] as const

const statusSchema = z.enum(TASK_STATUSES)

const attachmentToAttachSchema = z.object({
  path: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().min(1),
})

const attachmentsSchema = z.object({
  toAttach: z.array(attachmentToAttachSchema).default([]),
  toRemove: z.array(z.string().uuid()).default([]),
})

const baseTaskSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: statusSchema.default('BACKLOG'),
  dueOn: z.string().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  attachments: attachmentsSchema.optional(),
})

type BaseTaskInput = z.infer<typeof baseTaskSchema>
type AttachmentPayload = z.infer<typeof attachmentsSchema>

type ActionResult = {
  error?: string
}

export async function saveTask(input: BaseTaskInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = baseTaskSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid task payload submitted.' }
  }

  const {
    id,
    projectId,
    title,
    description,
    status,
    dueOn,
    assigneeIds,
    attachments,
  } = parsed.data

  const supabase = getSupabaseServerClient()
  const storage = getSupabaseServiceClient()

  await ensureTaskAttachmentBucket(storage)

  if (!id) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        title,
        description,
        status,
        due_on: dueOn,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .maybeSingle()

    if (error || !data) {
      console.error('Failed to create task', error)
      return { error: error?.message ?? 'Unable to create task.' }
    }

    try {
      await syncAssignees(supabase, data.id, assigneeIds)
      await syncAttachments({
        supabase,
        storage,
        taskId: data.id,
        actorId: user.id,
        actorRole: user.role,
        attachmentsInput: attachments,
      })
    } catch (assigneeError) {
      console.error('Failed to sync task assignees', assigneeError)
      return { error: 'Task saved but assignees could not be updated.' }
    }
  } else {
    const { error } = await supabase
      .from('tasks')
      .update({
        title,
        description,
        status,
        due_on: dueOn,
        updated_by: user.id,
      })
      .eq('id', id)

    if (error) {
      console.error('Failed to update task', error)
      return { error: error.message }
    }

    try {
      await syncAssignees(supabase, id, assigneeIds)
      await syncAttachments({
        supabase,
        storage,
        taskId: id,
        actorId: user.id,
        actorRole: user.role,
        attachmentsInput: attachments,
      })
    } catch (assigneeError) {
      console.error('Failed to sync task assignees', assigneeError)
      return { error: 'Task saved but assignees could not be updated.' }
    }
  }

  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}

export async function changeTaskStatus(input: {
  taskId: string
  status: (typeof TASK_STATUSES)[number]
}): Promise<ActionResult> {
  await requireUser()
  const parsed = z
    .object({
      taskId: z.string().uuid(),
      status: statusSchema,
    })
    .safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid status update payload.' }
  }

  const supabase = getSupabaseServerClient()
  const { taskId, status } = parsed.data

  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)

  if (error) {
    console.error('Failed to update task status', error)
    return { error: error.message }
  }

  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}

export async function removeTask(input: {
  taskId: string
}): Promise<ActionResult> {
  await requireUser()
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

  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}

async function syncAssignees(
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

async function syncAttachments({
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
