'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { SupabaseClient } from '@supabase/supabase-js'

import { logActivity } from '@/lib/activity/logger'
import {
  taskArchivedEvent,
  taskCreatedEvent,
  taskStatusChangedEvent,
  taskUpdatedEvent,
} from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import type { Database, Json } from '@/supabase/types/database'
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
  'BLOCKED',
  'IN_REVIEW',
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

  const normalizedAssigneeIds = Array.from(new Set(assigneeIds))
  const supabase = getSupabaseServerClient()
  const storage = getSupabaseServiceClient()

  await ensureTaskAttachmentBucket(storage)

  if (!id) {
    const { data: projectContext, error: projectError } = await supabase
      .from('projects')
      .select('id, client_id, name')
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle()

    if (projectError) {
      console.error('Failed to load project for task creation', projectError)
      return { error: 'Unable to resolve project for new task.' }
    }

    if (!projectContext) {
      return { error: 'Selected project is unavailable.' }
    }

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
      await syncAssignees(supabase, data.id, normalizedAssigneeIds)
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

    const event = taskCreatedEvent({
      title,
      status,
      dueOn: dueOn ?? null,
      assigneeIds: normalizedAssigneeIds,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'TASK',
      targetId: data.id,
      targetProjectId: projectId,
      targetClientId: projectContext.client_id,
      metadata: event.metadata,
    })
  } else {
    const { data: existingTask, error: existingTaskError } = await supabase
      .from('tasks')
      .select(
        `
          id,
          project_id,
          title,
          description,
          status,
          due_on,
          project:projects (
            client_id
          )
        `
      )
      .eq('id', id)
      .maybeSingle()

    if (existingTaskError) {
      console.error('Failed to load task for update', existingTaskError)
      return { error: 'Unable to update task.' }
    }

    if (!existingTask) {
      return { error: 'Task not found.' }
    }

    const { data: existingAssigneesData, error: existingAssigneesError } =
      await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', id)
        .is('deleted_at', null)

    if (existingAssigneesError) {
      console.error('Failed to load task assignees', existingAssigneesError)
      return { error: 'Unable to update task.' }
    }

    const existingAssigneeIds = (existingAssigneesData ?? []).map(
      assignee => assignee.user_id
    )

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
      await syncAssignees(supabase, id, normalizedAssigneeIds)
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

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingTask.title !== title) {
      changedFields.push('title')
      previousDetails.title = existingTask.title
      nextDetails.title = title
    }

    const previousDescription = existingTask.description ?? null
    const nextDescription = description ?? null

    if (previousDescription !== nextDescription) {
      changedFields.push('description')
      previousDetails.description = previousDescription
      nextDetails.description = nextDescription
    }

    if (existingTask.status !== status) {
      changedFields.push('status')
      previousDetails.status = existingTask.status
      nextDetails.status = status
    }

    const previousDueOn = existingTask.due_on ?? null
    const nextDueOn = dueOn ?? null

    if (previousDueOn !== nextDueOn) {
      changedFields.push('due date')
      previousDetails.dueOn = previousDueOn
      nextDetails.dueOn = nextDueOn
    }

    const addedAssignees = normalizedAssigneeIds.filter(
      assigneeId => !existingAssigneeIds.includes(assigneeId)
    )
    const removedAssignees = existingAssigneeIds.filter(
      assigneeId => !normalizedAssigneeIds.includes(assigneeId)
    )

    const hasAssigneeChanges =
      addedAssignees.length > 0 || removedAssignees.length > 0

    if (hasAssigneeChanges) {
      changedFields.push('assignees')
    }

    const hasDetailChanges =
      Object.keys(previousDetails).length > 0 ||
      Object.keys(nextDetails).length > 0

    if (changedFields.length > 0 || hasAssigneeChanges) {
      const event = taskUpdatedEvent({
        title,
        changedFields,
        details: hasDetailChanges
          ? {
              before: previousDetails,
              after: nextDetails,
            }
          : undefined,
        assigneeChanges: hasAssigneeChanges
          ? { added: addedAssignees, removed: removedAssignees }
          : undefined,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'TASK',
        targetId: id,
        targetProjectId: existingTask.project_id,
        targetClientId: existingTask.project?.client_id ?? null,
        metadata: event.metadata,
      })
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

  const supabase = getSupabaseServerClient()
  const { taskId, status } = parsed.data

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select(
      `
        id,
        title,
        status,
        project_id,
        project:projects (
          client_id
        )
      `
    )
    .eq('id', taskId)
    .maybeSingle()

  if (taskError) {
    console.error('Failed to load task for status change', taskError)
    return { error: 'Unable to update task status.' }
  }

  if (!task) {
    return { error: 'Task not found.' }
  }

  if (task.status !== status) {
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)

    if (error) {
      console.error('Failed to update task status', error)
      return { error: error.message }
    }

    const event = taskStatusChangedEvent({
      title: task.title,
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
      targetProjectId: task.project_id,
      targetClientId: task.project?.client_id ?? null,
      metadata: event.metadata,
    })
  }

  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}

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
