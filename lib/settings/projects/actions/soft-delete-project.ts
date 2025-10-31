'use server'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectArchivedEvent } from '@/lib/activity/events'
import {
  deleteProjectSchema,
  type DeleteProjectInput,
  type ProjectActionResult,
} from '@/lib/settings/projects/project-service'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { revalidateProjectSettings } from './shared'

export async function softDeleteProject(
  input: DeleteProjectInput
): Promise<ProjectActionResult> {
  const user = await requireUser()
  const parsed = deleteProjectSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const projectId = parsed.data.id

  const { data: existingProject, error: loadError } = await supabase
    .from('projects')
    .select('id, name, client_id')
    .eq('id', projectId)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load project for archive', loadError)
    return { error: 'Unable to archive project.' }
  }

  if (!existingProject) {
    return { error: 'Project not found.' }
  }

  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', projectId)

  if (error) {
    console.error('Failed to archive project', error)
    return { error: error.message }
  }

  const event = projectArchivedEvent({ name: existingProject.name })

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

  return {}
}
