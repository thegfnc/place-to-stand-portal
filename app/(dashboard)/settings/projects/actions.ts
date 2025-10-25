'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { requireUser } from '@/lib/auth/session'
import { PROJECT_STATUS_ENUM_VALUES } from '@/lib/constants'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/supabase/types/database'

const projectSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, 'Project name is required'),
    clientId: z.string().uuid('Select a client'),
    status: z.enum(PROJECT_STATUS_ENUM_VALUES),
    startsOn: z.string().nullable().optional(),
    endsOn: z.string().nullable().optional(),
    slug: z
      .string()
      .regex(
        /^[a-z0-9-]+$/,
        'Slugs can only contain lowercase letters, numbers, and dashes'
      )
      .or(z.literal(''))
      .nullish()
      .transform(value => (value ? value : null)),
    contractorIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startsOn && data.endsOn) {
      const start = new Date(data.startsOn)
      const end = new Date(data.endsOn)

      if (
        !Number.isNaN(start.valueOf()) &&
        !Number.isNaN(end.valueOf()) &&
        end < start
      ) {
        ctx.addIssue({
          path: ['endsOn'],
          code: z.ZodIssueCode.custom,
          message: 'End date must be on or after the start date.',
        })
      }
    }
  })

const deleteSchema = z.object({ id: z.string().uuid() })

type ActionResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

type ProjectInput = z.infer<typeof projectSchema>

type DeleteInput = z.infer<typeof deleteSchema>

const UNIQUE_RETRY_LIMIT = 3

function toSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || 'project'
}

async function slugExists(
  supabase: SupabaseClient<Database>,
  slug: string,
  options: { excludeId?: string } = {}
): Promise<boolean | PostgrestError> {
  let query = supabase.from('projects').select('id').eq('slug', slug).limit(1)

  if (options.excludeId) {
    query = query.neq('id', options.excludeId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('Failed to check project slug availability', error)
    return error
  }

  return Boolean(data)
}

async function generateUniqueSlug(
  supabase: SupabaseClient<Database>,
  base: string
): Promise<string | PostgrestError> {
  const normalizedBase = base || 'project'
  let candidate = normalizedBase
  let suffix = 2

  while (true) {
    const exists = await slugExists(supabase, candidate)

    if (typeof exists !== 'boolean') {
      return exists
    }

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1
  }
}

export async function saveProject(input: ProjectInput): Promise<ActionResult> {
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
  const normalizedProvidedSlug = providedSlug ? toSlug(providedSlug) : null

  if (normalizedProvidedSlug && normalizedProvidedSlug.length < 3) {
    return { error: 'Slug must be at least 3 characters.' }
  }

  if (!trimmedName) {
    return { error: 'Project name is required.' }
  }

  if (!id) {
    const baseSlug = normalizedProvidedSlug ?? toSlug(trimmedName)
    const initialSlug = await generateUniqueSlug(supabase, baseSlug)

    if (typeof initialSlug !== 'string') {
      return { error: 'Unable to generate project slug.' }
    }

    let slugCandidate = initialSlug
    let insertedId: string | null = null
    let attempt = 0

    while (attempt < UNIQUE_RETRY_LIMIT) {
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

      const nextSlug = await generateUniqueSlug(supabase, baseSlug)

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
      const exists = await slugExists(supabase, slugToUpdate, { excludeId: id })

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
  input: DeleteInput
): Promise<ActionResult> {
  await requireUser()
  const parsed = deleteSchema.safeParse(input)

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

async function syncProjectContractors(
  supabase: SupabaseClient<Database>,
  projectId: string,
  contractorIds: string[]
): Promise<ActionResult> {
  const uniqueIds = Array.from(new Set(contractorIds))

  if (uniqueIds.length) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, deleted_at')
      .in('id', uniqueIds)

    if (usersError) {
      console.error('Failed to validate contractor assignments', usersError)
      return { error: 'Unable to validate selected contractors.' }
    }

    const invalidUsers = (users ?? []).filter(
      user => user.deleted_at !== null || user.role !== 'CONTRACTOR'
    )

    if (invalidUsers.length > 0) {
      return { error: 'Only active contractor users can be assigned.' }
    }
  }

  const { data: members, error: membersError } = await supabase
    .from('project_members')
    .select('id, user_id, deleted_at, user:users ( role, deleted_at )')
    .eq('project_id', projectId)

  if (membersError) {
    console.error('Failed to load existing project members', membersError)
    return { error: 'Unable to update project members.' }
  }

  const projectMembers = (members ?? []) as Array<
    Database['public']['Tables']['project_members']['Row'] & {
      user: {
        role: Database['public']['Enums']['user_role'] | null
        deleted_at: string | null
      } | null
    }
  >

  const uniqueSet = new Set(uniqueIds)
  const deletionTimestamp = new Date().toISOString()

  const archiveIds = projectMembers
    .filter(
      member =>
        member.user?.role === 'CONTRACTOR' &&
        member.deleted_at === null &&
        !uniqueSet.has(member.user_id)
    )
    .map(member => member.id)

  if (archiveIds.length > 0) {
    const { error: archiveError } = await supabase
      .from('project_members')
      .update({ deleted_at: deletionTimestamp })
      .in('id', archiveIds)

    if (archiveError) {
      console.error('Failed to archive removed contractors', archiveError)
      return { error: 'Unable to update project members.' }
    }
  }

  if (uniqueIds.length === 0) {
    return {}
  }

  const upsertPayload = uniqueIds.map(userId => ({
    project_id: projectId,
    user_id: userId,
    role: 'CONTRIBUTOR' as Database['public']['Enums']['member_role'],
    deleted_at: null,
  }))

  const { error: upsertError } = await supabase
    .from('project_members')
    .upsert(upsertPayload, { onConflict: 'project_id,user_id' })

  if (upsertError) {
    console.error('Failed to upsert contractor members', upsertError)
    return { error: 'Unable to update project members.' }
  }

  return {}
}
