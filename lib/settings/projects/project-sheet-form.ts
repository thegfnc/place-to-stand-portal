import { z } from 'zod'

import {
  PROJECT_STATUS_ENUM_VALUES,
  PROJECT_STATUS_OPTIONS,
  PROJECT_STATUS_VALUES,
  type ProjectStatusValue,
} from '@/lib/constants'
import type {
  DbClient,
  DbProject,
  ProjectTypeValue,
} from '@/lib/types'

export type ProjectRow = DbProject
export type ClientRow = Pick<DbClient, 'id' | 'name' | 'deleted_at'>

export type ProjectOwnerSummary = {
  id: string | null
  fullName: string | null
  email: string | null
}

export type ProjectWithClient = ProjectRow & {
  client: ClientRow | null
  owner?: ProjectOwnerSummary | null
}

export type ContractorUserSummary = {
  id: string
  email: string
  fullName: string | null
}

export const PROJECT_TYPE_ENUM_VALUES = [
  'CLIENT',
  'PERSONAL',
  'INTERNAL',
] as const satisfies ReadonlyArray<ProjectTypeValue>

export const PROJECT_TYPE_OPTIONS: ReadonlyArray<{
  value: ProjectTypeValue
  label: string
  description: string
}> = [
  {
    value: 'CLIENT',
    label: 'Client project',
    description: 'Linked to a client workspace for shared tracking.',
  },
  {
    value: 'PERSONAL',
    label: 'Personal project',
    description: 'Visible only to you. Client selection is disabled.',
  },
  {
    value: 'INTERNAL',
    label: 'Internal project',
    description: 'Visible to the whole team without a client link.',
  },
] as const

export const projectSheetFormSchema = z
  .object({
    name: z.string().min(1, 'Project name is required'),
    projectType: z.enum(PROJECT_TYPE_ENUM_VALUES).default('CLIENT'),
    clientId: z
      .string()
      .uuid('Select a client')
      .or(z.literal(''))
      .optional(),
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

    const trimmedClientId = data.clientId?.trim() ?? ''
    const requiresClient = data.projectType === 'CLIENT'
    const hasClient = Boolean(trimmedClientId)

    if (requiresClient && !hasClient) {
      ctx.addIssue({
        path: ['clientId'],
        code: z.ZodIssueCode.custom,
        message: 'Select a client for client projects.',
      })
    }

    if (!requiresClient && hasClient) {
      ctx.addIssue({
        path: ['clientId'],
        code: z.ZodIssueCode.custom,
        message: 'Personal and internal projects cannot be linked to clients.',
      })
    }
  })

export type ProjectSheetFormValues = z.infer<typeof projectSheetFormSchema>

export const PROJECT_FORM_FIELDS: Array<keyof ProjectSheetFormValues> = [
  'name',
  'projectType',
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
  projectType: project?.type ?? 'CLIENT',
  clientId: project?.client_id ?? '',
  status: deriveInitialStatus(project),
  startsOn: project?.starts_on ? project.starts_on.slice(0, 10) : '',
  endsOn: project?.ends_on ? project.ends_on.slice(0, 10) : '',
  slug: project?.slug ?? '',
})

export type ProjectSavePayload = {
  id?: string
  name: string
  projectType: ProjectTypeValue
  clientId: string | null
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
}: CreatePayloadArgs): ProjectSavePayload => {
  const trimmedClientId = values.clientId?.trim() ?? ''
  const normalizedClientId =
    values.projectType === 'CLIENT' && trimmedClientId ? trimmedClientId : null

  return {
    id: project?.id,
    name: values.name.trim(),
    projectType: values.projectType,
    clientId: normalizedClientId,
    status: values.status,
    startsOn: values.startsOn ? values.startsOn : null,
    endsOn: values.endsOn ? values.endsOn : null,
    slug: isEditing ? (values.slug?.trim() ? values.slug.trim() : null) : null,
  }
}

export const sortClientsByName = (clients: ClientRow[]): ClientRow[] =>
  [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
