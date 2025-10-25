'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { SupabaseClient } from '@supabase/supabase-js'

import { requireUser } from '@/lib/auth/session'
import type { Database } from '@/supabase/types/database'
import { getSupabaseServerClient } from '@/lib/supabase/server'

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

const baseTaskSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: statusSchema.default('BACKLOG'),
  dueOn: z.string().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).default([]),
})

type BaseTaskInput = z.infer<typeof baseTaskSchema>

type ActionResult = {
  error?: string
}

export async function saveTask(input: BaseTaskInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = baseTaskSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid task payload submitted.' }
  }

  const { id, projectId, title, description, status, dueOn, assigneeIds } =
    parsed.data

  const supabase = getSupabaseServerClient()

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
  const { taskId } = parsed.data

  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) {
    console.error('Failed to soft delete task', error)
    return { error: error.message }
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
