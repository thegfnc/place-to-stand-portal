import 'server-only'

import { cache } from 'react'

import type { UserRole } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ProjectWithRelations } from '@/lib/types'

import { assembleProjectsWithRelations } from './assemble-projects'
import { fetchBaseProjects } from './fetch-base-projects'
import { fetchProjectRelations } from './fetch-project-relations'

export type FetchProjectsWithRelationsOptions = {
  forUserId?: string
  forRole?: UserRole
}

export const fetchProjectsWithRelations = cache(
  async (
    options: FetchProjectsWithRelationsOptions = {}
  ): Promise<ProjectWithRelations[]> => {
    const supabase = getSupabaseServiceClient()

    const baseProjects = await fetchBaseProjects(supabase)

    const shouldScopeToUser =
      options.forRole !== 'ADMIN' && Boolean(options.forUserId)

    const relations = await fetchProjectRelations(supabase, {
      projectIds: baseProjects.projectIds,
      clientIds: baseProjects.clientIds,
      shouldScopeToUser,
      userId: options.forUserId,
    })

    return assembleProjectsWithRelations({
      projects: baseProjects.projects,
      projectClientLookup: baseProjects.projectClientLookup,
      options,
      shouldScopeToUser,
      relations,
    })
  }
)
