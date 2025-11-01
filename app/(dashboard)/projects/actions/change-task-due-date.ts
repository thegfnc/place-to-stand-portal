'use server'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { taskUpdatedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const dueOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()

export async function changeTaskDueDate(input: {
  taskId: string
  dueOn: string | null
}): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = z
    .object({
      taskId: z.string().uuid(),
      dueOn: dueOnSchema,
    })
    .safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid due date update payload.' }
  }

  const { taskId, dueOn } = parsed.data
  const supabase = getSupabaseServerClient()

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select(
      `
        id,
        title,
        due_on,
        project_id,
        project:projects (
          client_id
        )
      `
    )
    .eq('id', taskId)
    .maybeSingle()

  if (taskError) {
    console.error('Failed to load task for due date change', taskError)
    return { error: 'Unable to update task due date.' }
  }

  if (!task) {
    return { error: 'Task not found.' }
  }

  const previousDueOn = task.due_on ?? null
  const nextDueOn = dueOn ?? null

  if (previousDueOn === nextDueOn) {
    return {}
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ due_on: nextDueOn })
    .eq('id', taskId)

  if (updateError) {
    console.error('Failed to update task due date', updateError)
    return { error: updateError.message }
  }

  const event = taskUpdatedEvent({
    title: task.title,
    changedFields: ['due date'],
    details: {
      dueOn: {
        from: previousDueOn,
        to: nextDueOn,
      },
    },
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

  revalidateProjectTaskViews()

  return {}
}
