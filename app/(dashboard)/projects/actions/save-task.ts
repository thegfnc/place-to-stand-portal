'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { taskCreatedEvent, taskUpdatedEvent } from '@/lib/activity/events'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'

import { baseTaskSchema, type BaseTaskInput, type ActionResult } from './shared'
import { syncAssignees, syncAttachments } from './task-helpers'

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
