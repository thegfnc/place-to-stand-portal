'use server'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { tasksAcceptedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const schema = z.object({
  projectId: z.string().uuid(),
})

export type AcceptDoneTasksResult = ActionResult & {
  acceptedCount: number
}

export async function acceptDoneTasks(input: {
  projectId: string
}): Promise<AcceptDoneTasksResult> {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    return { error: 'Only administrators can accept tasks.', acceptedCount: 0 }
  }

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid acceptance payload.', acceptedCount: 0 }
  }

  const supabase = getSupabaseServerClient()
  const { projectId } = parsed.data

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, client_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) {
    console.error('Failed to load project for bulk acceptance', projectError)
    return { error: 'Unable to load project details.', acceptedCount: 0 }
  }

  if (!project) {
    return { error: 'Project not found.', acceptedCount: 0 }
  }

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('project_id', projectId)
    .eq('status', 'DONE')
    .is('deleted_at', null)
    .is('accepted_at', null)

  if (tasksError) {
    console.error('Failed to load tasks for bulk acceptance', tasksError)
    return {
      error: 'Unable to load tasks awaiting acceptance.',
      acceptedCount: 0,
    }
  }

  const tasksToAccept = tasks ?? []

  if (tasksToAccept.length === 0) {
    return { acceptedCount: 0 }
  }

  const timestamp = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ accepted_at: timestamp })
    .eq('project_id', projectId)
    .eq('status', 'DONE')
    .is('deleted_at', null)
    .is('accepted_at', null)

  if (updateError) {
    console.error('Failed to bulk accept tasks', updateError)
    return { error: updateError.message, acceptedCount: 0 }
  }

  const event = tasksAcceptedEvent({
    count: tasksToAccept.length,
    projectName: project.name,
    taskIds: tasksToAccept.map(task => task.id),
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROJECT',
    targetId: project.id,
    targetProjectId: project.id,
    targetClientId: project.client_id,
    metadata: event.metadata,
  })

  revalidateProjectTaskViews()

  return { acceptedCount: tasksToAccept.length }
}
