'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import {
  projectArchivedEvent,
  projectCreatedEvent,
  projectUpdatedEvent,
  projectDeletedEvent,
  projectRestoredEvent,
} from '@/lib/activity/events'
import {
  deleteProjectSchema,
  destroyProjectSchema,
  generateUniqueProjectSlug,
  projectSchema,
  projectSlugExists,
  restoreProjectSchema,
  syncProjectContractors,
  toProjectSlug,
  type DeleteProjectInput,
  type DestroyProjectInput,
  type ProjectActionResult,
  type ProjectInput,
  type RestoreProjectInput,
} from '@/lib/settings/projects/project-service'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const INSERT_RETRY_LIMIT = 3

export async function saveProject(
  input: ProjectInput
): Promise<ProjectActionResult> {
  const user = await requireUser()
  const parsed = projectSchema.safeParse(input)

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const supabase = getSupabaseServerClient()
  const { id, name, clientId, status, startsOn, endsOn, slug, contractorIds } =
    parsed.data

  const trimmedName = name.trim()
  const normalizedContractorIds = Array.from(new Set(contractorIds ?? []))
  const providedSlug = slug?.trim() ?? null
  const normalizedProvidedSlug = providedSlug
    ? toProjectSlug(providedSlug)
    : null

  if (normalizedProvidedSlug && normalizedProvidedSlug.length < 3) {
    return { error: 'Slug must be at least 3 characters.' }
  }

  if (!trimmedName) {
    return { error: 'Project name is required.' }
  }

  if (!id) {
    const baseSlug = normalizedProvidedSlug ?? toProjectSlug(trimmedName)
    const initialSlug = await generateUniqueProjectSlug(supabase, baseSlug)

    if (typeof initialSlug !== 'string') {
      return { error: 'Unable to generate project slug.' }
    }

    let slugCandidate = initialSlug
    let insertedId: string | null = null
    let attempt = 0

    while (attempt < INSERT_RETRY_LIMIT) {
      const { data: inserted, error } = await supabase
        .from('projects')
        .insert({
          name: trimmedName,
          client_id: clientId,
          status,
          starts_on: startsOn ?? null,
          ends_on: endsOn ?? null,
          created_by: user.id,
          slug: slugCandidate,
        })
        .select('id')
        .maybeSingle()

      if (!error && inserted?.id) {
        insertedId = inserted.id
        break
      }

      if (error?.code !== '23505') {
        console.error('Failed to create project', error)
        return { error: error?.message ?? 'Unable to create project.' }
      }

      const nextSlug = await generateUniqueProjectSlug(supabase, baseSlug)

      if (typeof nextSlug !== 'string') {
        return { error: 'Unable to generate project slug.' }
      }

      slugCandidate = nextSlug
      attempt += 1
    }

    if (!insertedId) {
      return {
        error: 'Could not generate a unique slug. Please try again.',
      }
    }

    const syncResult = await syncProjectContractors(
      supabase,
      insertedId,
      normalizedContractorIds
    )

    if (syncResult.error) {
      return syncResult
    }

    const event = projectCreatedEvent({
      name: trimmedName,
      status,
      contractorIds: normalizedContractorIds,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'PROJECT',
      targetId: insertedId,
      targetProjectId: insertedId,
      targetClientId: clientId,
      metadata: event.metadata,
    })
  } else {
    const slugToUpdate = normalizedProvidedSlug

    if (slugToUpdate) {
      const exists = await projectSlugExists(supabase, slugToUpdate, {
        excludeId: id,
      })

      if (typeof exists !== 'boolean') {
        return { error: 'Unable to validate slug availability.' }
      }

      if (exists) {
        return { error: 'Another project already uses this slug.' }
      }
    }

    const { data: existingProject, error: existingProjectError } =
      await supabase
        .from('projects')
        .select('id, name, status, starts_on, ends_on, slug, client_id')
        .eq('id', id)
        .maybeSingle()

    if (existingProjectError) {
      console.error('Failed to load project for update', existingProjectError)
      return { error: 'Unable to update project.' }
    }

    if (!existingProject) {
      return { error: 'Project not found.' }
    }

    const { data: existingContractorRows, error: existingContractorsError } =
      await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', id)
        .is('deleted_at', null)

    if (existingContractorsError) {
      console.error('Failed to load project members', existingContractorsError)
      return { error: 'Unable to update project members.' }
    }

    const existingContractorIds = (existingContractorRows ?? []).map(
      member => member.user_id
    )

    const { error } = await supabase
      .from('projects')
      .update({
        name: trimmedName,
        client_id: clientId,
        status,
        starts_on: startsOn ?? null,
        ends_on: endsOn ?? null,
        slug: slugToUpdate,
      })
      .eq('id', id)

    if (error) {
      console.error('Failed to update project', error)
      return { error: error.message }
    }

    const syncResult = await syncProjectContractors(
      supabase,
      id,
      normalizedContractorIds
    )

    if (syncResult.error) {
      return syncResult
    }

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingProject.name !== trimmedName) {
      changedFields.push('name')
      previousDetails.name = existingProject.name
      nextDetails.name = trimmedName
    }

    if (existingProject.status !== status) {
      changedFields.push('status')
      previousDetails.status = existingProject.status
      nextDetails.status = status
    }

    const previousStartsOn = existingProject.starts_on ?? null
    const nextStartsOn = startsOn ?? null

    if (previousStartsOn !== nextStartsOn) {
      changedFields.push('start date')
      previousDetails.startsOn = previousStartsOn
      nextDetails.startsOn = nextStartsOn
    }

    const previousEndsOn = existingProject.ends_on ?? null
    const nextEndsOn = endsOn ?? null

    if (previousEndsOn !== nextEndsOn) {
      changedFields.push('end date')
      previousDetails.endsOn = previousEndsOn
      nextDetails.endsOn = nextEndsOn
    }

    const previousSlug = existingProject.slug ?? null
    const nextSlug = slugToUpdate ?? null

    if (previousSlug !== nextSlug) {
      changedFields.push('slug')
      previousDetails.slug = previousSlug
      nextDetails.slug = nextSlug
    }

    const addedContractors = normalizedContractorIds.filter(
      contractorId => !existingContractorIds.includes(contractorId)
    )
    const removedContractors = existingContractorIds.filter(
      contractorId => !normalizedContractorIds.includes(contractorId)
    )

    const hasContractorChanges =
      addedContractors.length > 0 || removedContractors.length > 0

    if (hasContractorChanges) {
      changedFields.push('contractors')
    }

    if (changedFields.length > 0 || hasContractorChanges) {
      const detailsPayload =
        Object.keys(previousDetails).length > 0 ||
        Object.keys(nextDetails).length > 0
          ? { before: previousDetails, after: nextDetails }
          : undefined

      const event = projectUpdatedEvent({
        name: trimmedName,
        changedFields,
        contractorChanges: hasContractorChanges
          ? { added: addedContractors, removed: removedContractors }
          : undefined,
        details: detailsPayload,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'PROJECT',
        targetId: id,
        targetProjectId: id,
        targetClientId: existingProject.client_id,
        metadata: event.metadata,
      })
    }
  }

  revalidatePath('/settings/projects')
  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}

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

  revalidatePath('/settings/projects')

  return {}
}

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

  revalidatePath('/settings/projects')
  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}

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

  revalidatePath('/settings/projects')
  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}
