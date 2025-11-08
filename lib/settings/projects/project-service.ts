import { z } from 'zod'

import { PROJECT_STATUS_ENUM_VALUES } from '@/lib/constants'
import {
  generateUniqueProjectSlugDrizzle,
  projectSlugExistsDrizzle,
} from '@/lib/queries/projects'

const DEFAULT_SLUG = 'project'

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

export function toProjectSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || DEFAULT_SLUG
}

export async function projectSlugExists(
  slug: string,
  options: { excludeId?: string } = {}
): Promise<boolean> {
  return projectSlugExistsDrizzle(slug, options)
}

export async function generateUniqueProjectSlug(base: string): Promise<string> {
  return generateUniqueProjectSlugDrizzle(base)
}

