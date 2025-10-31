'use server'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectRestoredEvent } from '@/lib/activity/events'
import {
  restoreProjectSchema,
  type ProjectActionResult,
  type RestoreProjectInput,
} from '@/lib/settings/projects/project-service'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

export async function restoreProject(
  input: RestoreProjectInput
): Promise<ProjectActionResult> {
  const user = await requireUser()
  const parsed = restoreProjectSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
  }

  const supabase = getSupabaseServerClient()
  const projectId = parsed.data.id

  const { data: existingProject, error: loadError } = await supabase
    .from('projects')
    .select('id, name, client_id, deleted_at')
    .eq('id', projectId)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load project for restore', loadError)
    return { error: 'Unable to restore project.' }
  }

  if (!existingProject) {
    return { error: 'Project not found.' }
  }

  if (!existingProject.deleted_at) {
    return { error: 'Project is already active.' }
  }

  const { error: restoreError } = await supabase
    .from('projects')
    .update({ deleted_at: null })
    .eq('id', projectId)

  if (restoreError) {
    console.error('Failed to restore project', restoreError)
    return { error: restoreError.message }
  }

  const event = projectRestoredEvent({ name: existingProject.name })

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
