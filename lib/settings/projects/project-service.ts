import { z } from 'zod'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { PROJECT_STATUS_ENUM_VALUES } from '@/lib/constants'
import type { Database } from '@/supabase/types/database'

export const projectSchema = z
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

const projectIdentifierSchema = {
  id: z.string().uuid(),
}

export const deleteProjectSchema = z.object(projectIdentifierSchema)
export const restoreProjectSchema = z.object(projectIdentifierSchema)
export const destroyProjectSchema = z.object(projectIdentifierSchema)

export type ProjectInput = z.infer<typeof projectSchema>
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>
export type RestoreProjectInput = z.infer<typeof restoreProjectSchema>
export type DestroyProjectInput = z.infer<typeof destroyProjectSchema>

export type ProjectActionResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

const DEFAULT_SLUG = 'project'
const UNIQUE_RETRY_LIMIT = 3

export function toProjectSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || DEFAULT_SLUG
}

export async function projectSlugExists(
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

export async function generateUniqueProjectSlug(
  supabase: SupabaseClient<Database>,
  base: string
): Promise<string | PostgrestError> {
  const normalizedBase = base || DEFAULT_SLUG
  let candidate = normalizedBase
  let suffix = 2

  while (true) {
    const exists = await projectSlugExists(supabase, candidate)

    if (typeof exists !== 'boolean') {
      return exists
    }

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1

    if (suffix > UNIQUE_RETRY_LIMIT + 1) {
      return `${normalizedBase}-${Date.now()}`
    }
  }
}

export async function syncProjectContractors(
  supabase: SupabaseClient<Database>,
  projectId: string,
  contractorIds: string[]
): Promise<ProjectActionResult> {
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
      user => user.deleted_at !== null || user.role !== 'ADMIN'
    )

    if (invalidUsers.length > 0) {
      return { error: 'Only active admin users can be assigned.' }
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
        member.user?.role === 'ADMIN' &&
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
