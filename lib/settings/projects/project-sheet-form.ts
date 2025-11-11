import { z } from 'zod'

import {
  PROJECT_STATUS_ENUM_VALUES,
  PROJECT_STATUS_OPTIONS,
  PROJECT_STATUS_VALUES,
  type ProjectStatusValue,
} from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

export type ProjectWithClient = ProjectRow & { client: ClientRow | null }

export type ContractorUserSummary = {
  id: string
  email: string
  fullName: string | null
}

export const projectSheetFormSchema = z
  .object({
    name: z.string().min(1, 'Project name is required'),
    clientId: z.string().uuid('Select a client'),
    status: z.enum(PROJECT_STATUS_ENUM_VALUES),
    startsOn: z.string().optional().or(z.literal('')),
    endsOn: z.string().optional().or(z.literal('')),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only')
      .or(z.literal(''))
      .optional(),
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

export type ProjectSheetFormValues = z.infer<typeof projectSheetFormSchema>

export const PROJECT_FORM_FIELDS: Array<keyof ProjectSheetFormValues> = [
  'name',
  'clientId',
  'status',
  'startsOn',
  'endsOn',
  'slug',
]

export const deriveInitialStatus = (
  project: ProjectWithClient | null
): ProjectStatusValue => {
  if (
    project &&
    PROJECT_STATUS_VALUES.includes(project.status as ProjectStatusValue)
  ) {
    return project.status as ProjectStatusValue
  }

  return PROJECT_STATUS_OPTIONS[0]?.value ?? 'active'
}

export const buildProjectFormDefaults = (
  project: ProjectWithClient | null
): ProjectSheetFormValues => ({
  name: project?.name ?? '',
  clientId: project?.client_id ?? '',
  status: deriveInitialStatus(project),
  startsOn: project?.starts_on ? project.starts_on.slice(0, 10) : '',
  endsOn: project?.ends_on ? project.ends_on.slice(0, 10) : '',
  slug: project?.slug ?? '',
})

export type ProjectSavePayload = {
  id?: string
  name: string
  clientId: string
  status: ProjectStatusValue
  startsOn: string | null
  endsOn: string | null
  slug: string | null
}

type CreatePayloadArgs = {
  values: ProjectSheetFormValues
  project: ProjectWithClient | null
  isEditing: boolean
}

export const createProjectSavePayload = ({
  values,
  project,
  isEditing,
}: CreatePayloadArgs): ProjectSavePayload => ({
  id: project?.id,
  name: values.name.trim(),
  clientId: values.clientId,
  status: values.status,
  startsOn: values.startsOn ? values.startsOn : null,
  endsOn: values.endsOn ? values.endsOn : null,
  slug: isEditing ? (values.slug?.trim() ? values.slug.trim() : null) : null,
})

export const sortClientsByName = (clients: ClientRow[]): ClientRow[] =>
  [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
