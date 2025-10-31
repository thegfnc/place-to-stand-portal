'use server'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskAcceptedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const schema = z.object({
  taskId: z.string().uuid(),
})

export async function acceptTask(input: {
  taskId: string
}): Promise<ActionResult> {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    return { error: 'Only administrators can accept tasks.' }
  }

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid acceptance payload.' }
  }

  const supabase = getSupabaseServerClient()
  const { taskId } = parsed.data

  const { data: task, error } = await supabase
    .from('tasks')
    .select(
      `
        id,
        title,
        status,
        accepted_at,
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
    console.error('Failed to load task for acceptance', error)
    return { error: 'Unable to accept task.' }
  }

  if (!task) {
    return { error: 'Task not found.' }
  }

  if (task.deleted_at) {
    return { error: 'Archived tasks cannot be accepted.' }
  }

  if (task.status !== 'DONE') {
    return { error: 'Only tasks marked as Done can be accepted.' }
  }

  if (task.accepted_at) {
    return {}
  }

  const timestamp = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ accepted_at: timestamp })
    .eq('id', taskId)

  if (updateError) {
    console.error('Failed to accept task', updateError)
    return { error: updateError.message }
  }

  const event = taskAcceptedEvent({ title: task.title })

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
