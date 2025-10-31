import type { DbProject } from '@/lib/types'

import type { SupabaseServiceClient } from './types'

export type BaseProjectFetchResult = {
  projects: DbProject[]
  projectIds: string[]
  clientIds: string[]
  projectClientLookup: Map<string, string | null>
}

export async function fetchBaseProjects(
  supabase: SupabaseServiceClient
): Promise<BaseProjectFetchResult> {
  const { data: projectRows, error } = await supabase
    .from('projects')
    .select(
      `
        id,
        name,
        status,
        client_id,
        slug,
        starts_on,
        ends_on,
        created_at,
        updated_at,
        deleted_at
      `
    )
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load projects', error)
    throw error
  }

  const projects = (projectRows ?? []) as DbProject[]
  const projectIds = projects.map(project => project.id)
  const clientIds = Array.from(
    new Set(
      projects
        .map(project => project.client_id)
        .filter((clientId): clientId is string => Boolean(clientId))
    )
  )

  const projectClientLookup = new Map<string, string | null>()
  projects.forEach(project => {
    projectClientLookup.set(project.id, project.client_id ?? null)
  })

  return {
    projects,
    projectIds,
    clientIds,
    projectClientLookup,
  }
}
