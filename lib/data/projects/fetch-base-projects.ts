import { and, asc, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import type { DbProject } from '@/lib/types'

export type BaseProjectFetchResult = {
  projects: DbProject[]
  projectIds: string[]
  clientIds: string[]
  projectClientLookup: Map<string, string | null>
}

export async function fetchBaseProjects(
  filterProjectIds?: string[]
): Promise<BaseProjectFetchResult> {
  const conditions = [isNull(projects.deletedAt)]

  if (filterProjectIds?.length) {
    conditions.push(inArray(projects.id, filterProjectIds))
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      type: projects.type,
      clientId: projects.clientId,
      slug: projects.slug,
      startsOn: projects.startsOn,
      endsOn: projects.endsOn,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      deletedAt: projects.deletedAt,
      createdBy: projects.createdBy,
    })
    .from(projects)
    .where(and(...conditions))
    .orderBy(asc(projects.name))

  const normalizedProjects: DbProject[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    status: row.status,
    type: row.type,
    client_id: row.clientId,
    slug: row.slug,
    starts_on: row.startsOn,
    ends_on: row.endsOn,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    created_by: row.createdBy ?? null,
  }))

  const projectIds = normalizedProjects.map(project => project.id)
  const clientIds = Array.from(
    new Set(
      normalizedProjects
        .map(project => project.client_id)
        .filter((clientId): clientId is string => Boolean(clientId))
    )
  )

  const projectClientLookup = new Map<string, string | null>()
  normalizedProjects.forEach(project => {
    projectClientLookup.set(project.id, project.client_id ?? null)
  })

  return {
    projects: normalizedProjects,
    projectIds,
    clientIds,
    projectClientLookup,
  }
}
