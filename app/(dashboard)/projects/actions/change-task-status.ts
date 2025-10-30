'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskStatusChangedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { statusSchema, TASK_STATUSES, type ActionResult } from './shared'

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
