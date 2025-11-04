'use server'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskStatusChangedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { revalidateProjectTaskViews } from './shared'
import { statusSchema, TASK_STATUSES } from './shared-schemas'
import type { ActionResult } from './action-types'
import { resolveNextTaskRank } from './task-rank'

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
    let nextRank: string

    try {
      nextRank = await resolveNextTaskRank(supabase, task.project_id, status)
    } catch (rankError) {
      console.error('Failed to resolve rank for task status change', rankError)
      return { error: 'Unable to update task ordering.' }
    }

    const { error } = await supabase
      .from('tasks')
      .update({
        status,
        rank: nextRank,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
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

  revalidateProjectTaskViews()

  return {}
}
