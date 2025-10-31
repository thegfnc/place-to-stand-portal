'use server'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskAcceptanceRevertedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const schema = z.object({
  taskId: z.string().uuid(),
})

export async function unacceptTask(input: {
  taskId: string
}): Promise<ActionResult> {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    return { error: 'Only administrators can modify accepted tasks.' }
  }

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid payload submitted.' }
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
        project_id,
        project:projects (
          client_id
        )
      `
    )
    .eq('id', taskId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load task for unaccepting', error)
    return { error: 'Unable to update task acceptance.' }
  }

  if (!task) {
    return { error: 'Task not found.' }
  }

  if (!task.accepted_at) {
    return {}
  }

  if (task.status !== 'DONE') {
    return { error: 'Only tasks marked as Done can be unaccepted.' }
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ accepted_at: null })
    .eq('id', taskId)

  if (updateError) {
    console.error('Failed to unaccept task', updateError)
    return { error: updateError.message }
  }

  const event = taskAcceptanceRevertedEvent({ title: task.title })

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
