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

// Note: syncProjectContractors has been removed
// Project access is now managed through client_members instead of project_members
// To add users to a project, add them as client members of the project's client
