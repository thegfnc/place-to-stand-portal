import { sql } from 'drizzle-orm'

import { clients, projects, users } from '@/lib/db/schema'
import type { ProjectTypeValue } from '@/lib/types'
import type { ProjectOwnerSummary } from '@/lib/settings/projects/project-sheet-form'
export type { ProjectOwnerSummary } from '@/lib/settings/projects/project-sheet-form'
import {
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'

export type SelectProject = typeof projects.$inferSelect

export const projectFields = {
  id: projects.id,
  clientId: projects.clientId,
  name: projects.name,
  status: projects.status,
  type: projects.type,
  startsOn: projects.startsOn,
  endsOn: projects.endsOn,
  slug: projects.slug,
  createdBy: projects.createdBy,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  deletedAt: projects.deletedAt,
} as const

export type ProjectClientSummary = {
  id: string
  name: string
  deletedAt: string | null
}

export type ProjectsSettingsListItem = typeof projects.$inferSelect & {
  client: ProjectClientSummary | null
  owner: ProjectOwnerSummary | null
}

export type ListProjectsForSettingsInput = {
  status?: 'active' | 'archived'
  search?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

export type ProjectsSettingsResult = {
  items: ProjectsSettingsListItem[]
  totalCount: number
  pageInfo: PageInfo
  clients: ProjectClientSummary[]
}

export const projectGroupByColumns = [
  projects.id,
  projects.name,
  projects.status,
  projects.slug,
  projects.clientId,
  projects.type,
  projects.createdBy,
  projects.startsOn,
  projects.endsOn,
  projects.createdAt,
  projects.updatedAt,
  projects.deletedAt,
  clients.id,
  clients.name,
  clients.deletedAt,
  users.id,
  users.fullName,
  users.email,
] as const

export const projectSelection = {
  id: projects.id,
  name: projects.name,
  status: projects.status,
  slug: projects.slug,
  clientId: projects.clientId,
  type: projects.type,
  createdBy: projects.createdBy,
  startsOn: projects.startsOn,
  endsOn: projects.endsOn,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  deletedAt: projects.deletedAt,
} as const

export type ProjectSelectionResult = {
  id: string
  name: string
  status: string
  slug: string | null
  clientId: string | null
  type: ProjectTypeValue
  createdBy: string | null
  startsOn: string | null
  endsOn: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export function buildProjectCursorCondition(
  direction: CursorDirection,
  cursor: { name?: string | null; id?: string | null } | null,
) {
  if (!cursor) {
    return null
  }

  const nameValue =
    typeof cursor.name === 'string' ? cursor.name : (cursor.name ?? '')
  const idValue = typeof cursor.id === 'string' ? cursor.id : ''

  if (!idValue) {
    return null
  }

  const normalizedName = sql`coalesce(${projects.name}, '')`

  if (direction === 'forward') {
    return sql`${normalizedName} > ${nameValue} OR (${normalizedName} = ${nameValue} AND ${projects.id} > ${idValue})`
  }

  return sql`${normalizedName} < ${nameValue} OR (${normalizedName} = ${nameValue} AND ${projects.id} < ${idValue})`
}

