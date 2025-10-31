'use server'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectDeletedEvent } from '@/lib/activity/events'
import {
  destroyProjectSchema,
  type DestroyProjectInput,
  type ProjectActionResult,
} from '@/lib/settings/projects/project-service'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

export async function destroyProject(
  input: DestroyProjectInput
): Promise<ProjectActionResult> {
  const user = await requireUser()
  const parsed = destroyProjectSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid permanent delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const projectId = parsed.data.id

  const { data: existingProject, error: loadError } = await supabase
    .from('projects')
    .select('id, name, client_id, deleted_at')
    .eq('id', projectId)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load project for permanent delete', loadError)
    return { error: 'Unable to permanently delete project.' }
  }

  if (!existingProject) {
    return { error: 'Project not found.' }
  }

  if (!existingProject.deleted_at) {
    return {
      error: 'Archive the project before permanently deleting.',
    }
  }

  const [
    { count: taskCount, error: taskError },
    { count: timeLogCount, error: timeLogError },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('time_logs')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
  ])

  if (taskError) {
    console.error('Failed to check project tasks before delete', taskError)
    return { error: 'Unable to verify task dependencies.' }
  }

  if (timeLogError) {
    console.error(
      'Failed to check project time logs before delete',
      timeLogError
    )
    return { error: 'Unable to verify time log dependencies.' }
  }

  const blockingResources: string[] = []

  if ((taskCount ?? 0) > 0) {
    blockingResources.push('tasks')
  }

  if ((timeLogCount ?? 0) > 0) {
    blockingResources.push('time logs')
  }

  if (blockingResources.length > 0) {
    const resourceSummary =
      blockingResources.length === 1
        ? blockingResources[0]
        : `${blockingResources.slice(0, -1).join(', ')} and ${
            blockingResources[blockingResources.length - 1]
          }`

    return {
      error: `Cannot permanently delete this project while ${resourceSummary} reference it.`,
    }
  }

  const { error: memberDeleteError } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)

  if (memberDeleteError) {
    console.error(
      'Failed to remove project memberships before delete',
      memberDeleteError
    )
    return { error: 'Unable to remove project memberships.' }
  }

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (deleteError) {
    console.error('Failed to permanently delete project', deleteError)
    return { error: deleteError.message }
  }

  const event = projectDeletedEvent({ name: existingProject.name })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROJECT',
    targetId: existingProject.id,
    targetProjectId: existingProject.id,
    targetClientId: existingProject.client_id,
    metadata: event.metadata,
  })

  await revalidateProjectSettings()
  await revalidateProjectDetailRoutes()

  return {}
}
