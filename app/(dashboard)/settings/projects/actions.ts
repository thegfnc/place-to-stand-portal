'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import {
  deleteProjectSchema,
  generateUniqueProjectSlug,
  projectSchema,
  projectSlugExists,
  syncProjectContractors,
  toProjectSlug,
  type DeleteProjectInput,
  type ProjectActionResult,
  type ProjectInput,
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
  }

  revalidatePath('/settings/projects')
  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')

  return {}
}

export async function softDeleteProject(
  input: DeleteProjectInput
): Promise<ProjectActionResult> {
  await requireUser()
  const parsed = deleteProjectSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)

  if (error) {
    console.error('Failed to archive project', error)
    return { error: error.message }
  }

  revalidatePath('/settings/projects')

  return {}
}
