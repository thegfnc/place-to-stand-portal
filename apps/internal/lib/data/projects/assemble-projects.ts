import type {
  DbClient,
  DbProject,
  ProjectMemberWithUser,
  ProjectOwner,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'

import type { ClientHoursTotals } from '@pts/db/hours'
import { clientHoursTotalsFor } from '@pts/db/hours'

import type {
  MemberWithUser,
  ProjectBurndown,
  RawTaskWithRelations,
  TimeLogSummary,
} from './types'
import type { ProjectRelationsFetchResult } from './fetch-project-relations'
import { normalizeRawTask } from './normalize-task'

export type AssembleProjectsArgs = {
  projects: DbProject[]
  projectClientLookup: Map<string, string | null>
  relations: ProjectRelationsFetchResult
  timeLogSummaries: Map<string, TimeLogSummary>
  /**
   * Client-scoped prepaid balances from `getClientHoursTotals`. Must NOT be
   * derived from `timeLogSummaries` — those cover only the projects this
   * request hydrated, which on a project workspace route is a single project.
   * Pass an empty map on surfaces that never render burndown.
   */
  clientHours: Map<string, ClientHoursTotals>
}

export function assembleProjectsWithRelations({
  projects,
  projectClientLookup,
  relations,
  timeLogSummaries,
  clientHours,
}: AssembleProjectsArgs): ProjectWithRelations[] {
  const clientLookup = buildClientLookup(relations.clients)
  const ownerLookup = buildOwnerLookup(relations.owners)
  const membersByProject = organizeMembers(
    relations.members,
    projectClientLookup
  )
  const timeLogTotalsByProject = timeLogSummaries
  const activeTasksByProject = groupTasksByProject(relations.tasks)
  const archivedTasksByProject = groupTasksByProject(relations.archivedTasks)
  sortArchivedTasksByDeletedAt(archivedTasksByProject)
  const acceptedTasksByProject = buildAcceptedTasksLookup(activeTasksByProject)

  return projects.map(project => ({
    ...project,
    client: project.client_id
      ? (clientLookup.get(project.client_id) ?? null)
      : null,
    owner: project.owner_id
      ? (ownerLookup.get(project.owner_id) ?? null)
      : null,
    members: membersByProject.get(project.id) ?? [],
    tasks: activeTasksByProject.get(project.id) ?? [],
    archivedTasks: archivedTasksByProject.get(project.id) ?? [],
    acceptedTasks: acceptedTasksByProject.get(project.id) ?? [],
    burndown: buildProjectBurndown(
      project,
      clientHours,
      timeLogTotalsByProject
    ),
    githubRepos: relations.githubReposByProject.get(project.id) ?? [],
    integrationLinks:
      relations.integrationLinksByProject.get(project.id) ?? [],
  }))
}

function buildClientLookup(clients: DbClient[]): Map<string, DbClient> {
  const clientLookup = new Map<string, DbClient>()
  clients.forEach(client => {
    if (!client?.id) {
      return
    }
    clientLookup.set(client.id, client)
  })
  return clientLookup
}

function buildOwnerLookup(owners: ProjectOwner[]): Map<string, ProjectOwner> {
  const ownerLookup = new Map<string, ProjectOwner>()
  owners.forEach(owner => {
    if (!owner?.id) {
      return
    }
    ownerLookup.set(owner.id, owner)
  })
  return ownerLookup
}

function organizeMembers(
  members: MemberWithUser[],
  projectClientLookup: Map<string, string | null>
): Map<string, ProjectMemberWithUser[]> {
  const membersByProject = new Map<string, ProjectMemberWithUser[]>()
  const membersByClient = new Map<string, MemberWithUser[]>()

  // First, organize members by client
  members.forEach(member => {
    if (
      !member ||
      member.deleted_at ||
      !member.user ||
      member.user.deleted_at ||
      !member.client_id
    ) {
      return
    }

    const memberList = membersByClient.get(member.client_id) ?? []
    memberList.push(member)
    membersByClient.set(member.client_id, memberList)
  })

  // Then, map client members to all projects under that client
  projectClientLookup.forEach((clientId, projectId) => {
    if (clientId) {
      const clientMembers = membersByClient.get(clientId) ?? []
      const projectMembers: ProjectMemberWithUser[] = clientMembers.map(
        member => ({
          id: member.id,
          project_id: projectId, // Map to project for backwards compatibility
          user_id: member.user_id,
          created_at: member.created_at,
          deleted_at: member.deleted_at,
          user: member.user!,
        })
      )
      membersByProject.set(projectId, projectMembers)
    }
  })

  return membersByProject
}

function groupTasksByProject(
  tasks: RawTaskWithRelations[]
): Map<string, TaskWithRelations[]> {
  const tasksByProject = new Map<string, TaskWithRelations[]>()

  tasks.forEach(task => {
    if (!task || !task.project_id) {
      return
    }

    const normalizedTask = normalizeRawTask(task)
    const existingTasks = tasksByProject.get(task.project_id) ?? []
    existingTasks.push(normalizedTask)
    tasksByProject.set(task.project_id, existingTasks)
  })

  return tasksByProject
}

function sortArchivedTasksByDeletedAt(
  archivedTasksByProject: Map<string, TaskWithRelations[]>
) {
  archivedTasksByProject.forEach(tasks => {
    tasks.sort((a, b) => {
      const aTime = a.deleted_at ? Date.parse(a.deleted_at) : 0
      const bTime = b.deleted_at ? Date.parse(b.deleted_at) : 0
      return bTime - aTime
    })
  })
}

function buildAcceptedTasksLookup(
  activeTasksByProject: Map<string, TaskWithRelations[]>
): Map<string, TaskWithRelations[]> {
  const lookup = new Map<string, TaskWithRelations[]>()

  activeTasksByProject.forEach((tasks, projectId) => {
    const accepted = tasks
      .filter(
        task => task.status === 'DONE' && task.accepted_at !== null
      )
      .sort((a, b) => {
        const aTime = a.accepted_at ? Date.parse(a.accepted_at) : 0
        const bTime = b.accepted_at ? Date.parse(b.accepted_at) : 0
        return bTime - aTime
      })

    lookup.set(projectId, accepted)
  })

  return lookup
}

function buildProjectBurndown(
  project: DbProject,
  clientHours: Map<string, ClientHoursTotals>,
  timeLogTotalsByProject: Map<string, TimeLogSummary>
): ProjectBurndown {
  const projectLogSummary = timeLogTotalsByProject.get(project.id) ?? null
  // Client-level totals come from the shared client-scoped query — every
  // project of the client counts toward the burndown, not just this one.
  const clientTotals = clientHoursTotalsFor(clientHours, project.client_id)
  const totalProjectLoggedHours = projectLogSummary?.totalHours ?? 0
  const projectMonthToDateLoggedHours =
    projectLogSummary?.monthToDateHours ?? 0
  const lastLogAt = projectLogSummary?.lastLogAt ?? null

  return {
    totalClientPurchasedHours: clientTotals.purchased,
    totalClientLoggedHours: clientTotals.used,
    totalClientRemainingHours: clientTotals.remaining,
    totalProjectLoggedHours,
    projectMonthToDateLoggedHours,
    lastLogAt,
  }
}
