'use server'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskDeletedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const schema = z.object({
  taskId: z.string().uuid(),
})

export async function destroyTask(input: {
  taskId: string
}): Promise<ActionResult> {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    return { error: 'Only administrators can permanently delete tasks.' }
  }

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete payload.' }
  }

  const supabase = getSupabaseServerClient()
  const { taskId } = parsed.data

  const { data: task, error } = await supabase
    .from('tasks')
    .select(
      `
        id,
        title,
        deleted_at,
        project_id,
        project:projects (
          client_id
        )
      `
    )
    .eq('id', taskId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load task for permanent delete', error)
    return { error: 'Unable to permanently delete task.' }
  }

  if (!task) {
    return { error: 'Task not found.' }
  }

  if (!task.deleted_at) {
    return {
      error: 'Archive the task before permanently deleting.',
    }
  }

  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (deleteError) {
    console.error('Failed to permanently delete task', deleteError)
    return { error: deleteError.message }
  }

  const event = taskDeletedEvent({ title: task.title })

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

  revalidateProjectTaskViews()

  return {}
}
