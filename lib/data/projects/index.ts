import 'server-only'

import { cache } from 'react'

import type { UserRole } from '@/lib/auth/session'
import type { ProjectWithRelations } from '@/lib/types'

import { getTimeLogSummariesForProjects } from '@/lib/queries/time-logs'
import { assembleProjectsWithRelations } from './assemble-projects'
import { fetchBaseProjects } from './fetch-base-projects'
import { fetchProjectRelations } from './fetch-project-relations'
export { fetchProjectCalendarTasks } from './fetch-project-calendar-tasks'

export type FetchProjectsWithRelationsOptions = {
  forUserId?: string
  forRole?: UserRole
}

export const fetchProjectsWithRelations = cache(
  async (
    options: FetchProjectsWithRelationsOptions = {}
  ): Promise<ProjectWithRelations[]> => {
    const baseProjects = await fetchBaseProjects()

    const shouldScopeToUser =
      options.forRole !== 'ADMIN' && Boolean(options.forUserId)

    const relations = await fetchProjectRelations({
      projectIds: baseProjects.projectIds,
      clientIds: baseProjects.clientIds,
      shouldScopeToUser,
      userId: options.forUserId,
    })

    const timeLogSummaries = await getTimeLogSummariesForProjects(
      baseProjects.projectIds
    )

    return assembleProjectsWithRelations({
      projects: baseProjects.projects,
      projectClientLookup: baseProjects.projectClientLookup,
      options,
      shouldScopeToUser,
      relations,
      timeLogSummaries,
    })
  }
)

export async function fetchProjectsWithRelationsByIds(
  projectIds: string[]
): Promise<ProjectWithRelations[]> {
  if (!projectIds.length) {
    return []
  }

  const baseProjects = await fetchBaseProjects(projectIds)
  const relations = await fetchProjectRelations({
    projectIds: baseProjects.projectIds,
    clientIds: baseProjects.clientIds,
    shouldScopeToUser: false,
  })

  const timeLogSummaries = await getTimeLogSummariesForProjects(
    baseProjects.projectIds
  )

  return assembleProjectsWithRelations({
    projects: baseProjects.projects,
    projectClientLookup: baseProjects.projectClientLookup,
    options: {},
    shouldScopeToUser: false,
    relations,
    timeLogSummaries,
  })
}
