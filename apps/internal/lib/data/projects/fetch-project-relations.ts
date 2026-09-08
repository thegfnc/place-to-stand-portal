import { and, inArray, isNull } from 'drizzle-orm'

import type { DbClient, GitHubRepoLinkSummary, ProjectOwner } from '@/lib/types'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

import type { MemberWithUser, RawTaskWithRelations } from './types'

import {
  loadClientRows,
  loadMemberRows,
  mapClientRows,
  mapMemberRows,
  type ClientRow,
  type MemberRow,
} from './relations/clients'
import {
  buildAssigneeMap,
  loadTaskAssigneeRows,
  loadTaskRows,
  mapTaskRowsToRaw,
  type TaskRow,
} from './relations/tasks'
import { getReposForProjects } from '@/lib/data/github-repos'
import { getIntegrationLinksForProjects } from '@/lib/data/project-integration-links'
import {
  toIntegrationLinkSummary,
  type ProjectIntegrationLinkSummary,
} from '@/lib/types/integrations'

export type ProjectRelationsFetchArgs = {
  projectIds: string[]
  clientIds: string[]
  ownerIds: string[]
  /**
   * Archived tasks grow without bound and only the project review/archive
   * tabs render them — every other surface skips the query entirely.
   */
  includeArchivedTasks?: boolean
}

export type ProjectRelationsFetchResult = {
  clients: DbClient[]
  owners: ProjectOwner[]
  members: MemberWithUser[]
  tasks: RawTaskWithRelations[]
  archivedTasks: RawTaskWithRelations[]
  githubReposByProject: Map<string, GitHubRepoLinkSummary[]>
  integrationLinksByProject: Map<string, ProjectIntegrationLinkSummary[]>
}

export async function loadOwners(ownerIds: string[]): Promise<ProjectOwner[]> {
  if (ownerIds.length === 0) {
    return []
  }

  const rows = await db
    .select({
      id: users.id,
      full_name: users.fullName,
      avatar_url: users.avatarUrl,
    })
    .from(users)
    .where(and(inArray(users.id, ownerIds), isNull(users.deletedAt)))

  return rows.map(row => ({
    id: row.id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
  }))
}

export async function fetchProjectRelations({
  projectIds,
  clientIds,
  ownerIds,
  includeArchivedTasks = false,
}: ProjectRelationsFetchArgs): Promise<ProjectRelationsFetchResult> {
  const clientDataPromise: Promise<[ClientRow[], MemberRow[]]> = Promise.all([
    loadClientRows(clientIds),
    loadMemberRows(clientIds),
  ])

  const taskDataPromise: Promise<[TaskRow[], TaskRow[]]> = Promise.all([
    loadTaskRows(projectIds, { archived: false }),
    includeArchivedTasks
      ? loadTaskRows(projectIds, { archived: true })
      : Promise.resolve([]),
  ])

  const githubReposPromise = getReposForProjects(projectIds)
  const integrationLinksPromise = getIntegrationLinksForProjects(projectIds)
  const ownersPromise = loadOwners(ownerIds)

  const [
    [clientRows, memberRows],
    [activeTaskRows, archivedTaskRows],
    githubReposMap,
    integrationLinksMap,
    owners,
  ] = await Promise.all([
    clientDataPromise,
    taskDataPromise,
    githubReposPromise,
    integrationLinksPromise,
    ownersPromise,
  ])

  const allTaskIds = [...activeTaskRows, ...archivedTaskRows].map(row => row.id)
  const assigneeRows = await loadTaskAssigneeRows(allTaskIds)
  const assigneesByTask = buildAssigneeMap(assigneeRows)

  const clients: DbClient[] = mapClientRows(clientRows)
  const members: MemberWithUser[] = mapMemberRows(memberRows)

  const tasks: RawTaskWithRelations[] = mapTaskRowsToRaw(
    activeTaskRows,
    assigneesByTask,
  )
  const archivedTasks: RawTaskWithRelations[] = mapTaskRowsToRaw(
    archivedTaskRows,
    assigneesByTask,
  )

  // Map GitHub repos to summary format
  const githubReposByProject = new Map<string, GitHubRepoLinkSummary[]>()
  githubReposMap.forEach((repos, projectId) => {
    githubReposByProject.set(
      projectId,
      repos.map(repo => ({
        id: repo.id,
        repoFullName: repo.repoFullName,
        defaultBranch: repo.defaultBranch,
      }))
    )
  })

  const integrationLinksByProject = new Map<
    string,
    ProjectIntegrationLinkSummary[]
  >()
  integrationLinksMap.forEach((links, projectId) => {
    integrationLinksByProject.set(
      projectId,
      links.map(toIntegrationLinkSummary)
    )
  })

  return {
    clients,
    owners,
    members,
    tasks,
    archivedTasks,
    githubReposByProject,
    integrationLinksByProject,
  }
}
