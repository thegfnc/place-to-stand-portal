import type { UserRole } from '@/lib/auth/session'
import type {
  DbClient,
  DbProject,
  ProjectMemberWithUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'

import type {
  ClientMembership,
  MemberWithUser,
  ProjectBurndown,
  RawHourBlock,
  RawTaskWithRelations,
  TimeLogSummary,
} from './types'
import type { ProjectRelationsFetchResult } from './fetch-project-relations'
import { normalizeRawTask } from './normalize-task'

export type AssembleProjectsArgs = {
  projects: DbProject[]
  projectClientLookup: Map<string, string | null>
  options: { forUserId?: string; forRole?: UserRole }
  shouldScopeToUser: boolean
  relations: ProjectRelationsFetchResult
  timeLogSummaries: Map<string, TimeLogSummary>
}

export function assembleProjectsWithRelations({
  projects,
  projectClientLookup,
  options,
  shouldScopeToUser,
  relations,
  timeLogSummaries,
}: AssembleProjectsArgs): ProjectWithRelations[] {
  const clientLookup = buildClientLookup(relations.clients)
  const membersByProject = organizeMembers(
    relations.members,
    projectClientLookup
  )
  const accessibleClientIds = buildAccessibleClientIds(
    relations.clientMemberships
  )
  const purchasedHoursByClient = tallyPurchasedHours(relations.hourBlocks)
  const timeLogTotalsByProject = timeLogSummaries
  const timeLogTotalsByClient = buildClientLogTotals(
    timeLogSummaries,
    projectClientLookup
  )
  const activeTasksByProject = groupTasksByProject(relations.tasks)
  const archivedTasksByProject = groupTasksByProject(relations.archivedTasks)

  const scopedProjects =
    shouldScopeToUser && options.forUserId
      ? scopeProjects(projects, accessibleClientIds)
      : projects

  return scopedProjects.map(project => ({
    ...project,
    client: project.client_id
      ? (clientLookup.get(project.client_id) ?? null)
      : null,
    members: membersByProject.get(project.id) ?? [],
    tasks: activeTasksByProject.get(project.id) ?? [],
    archivedTasks: archivedTasksByProject.get(project.id) ?? [],
    burndown: buildProjectBurndown(
      project,
      purchasedHoursByClient,
      timeLogTotalsByProject,
      timeLogTotalsByClient
    ),
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

function buildAccessibleClientIds(
  clientMemberships: ClientMembership[]
): Set<string> {
  const accessibleClientIds = new Set<string>()
  clientMemberships.forEach(entry => {
    if (!entry || entry.deleted_at || !entry.client_id) {
      return
    }
    accessibleClientIds.add(entry.client_id)
  })
  return accessibleClientIds
}

function tallyPurchasedHours(blocks: RawHourBlock[]): Map<string, number> {
  const purchasedHoursByClient = new Map<string, number>()
  blocks.forEach(block => {
    if (!block || block.deleted_at || !block.client_id) {
      return
    }
    const total = purchasedHoursByClient.get(block.client_id) ?? 0
    purchasedHoursByClient.set(
      block.client_id,
      total + Number(block.hours_purchased)
    )
  })
  return purchasedHoursByClient
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

function scopeProjects(
  projects: DbProject[],
  accessibleClientIds: Set<string>
): DbProject[] {
  return projects.filter(project => {
    if (project.client_id && accessibleClientIds.has(project.client_id)) {
      return true
    }

    return false
  })
}

function buildProjectBurndown(
  project: DbProject,
  purchasedHoursByClient: Map<string, number>,
  timeLogTotalsByProject: Map<string, TimeLogSummary>,
  timeLogTotalsByClient: Map<string, number>
): ProjectBurndown {
  const projectLogSummary = timeLogTotalsByProject.get(project.id) ?? null
  const clientId = project.client_id ?? null
  const totalClientPurchasedHours = clientId
    ? (purchasedHoursByClient.get(clientId) ?? 0)
    : 0
  const totalProjectLoggedHours = projectLogSummary?.totalHours ?? 0
  const totalClientLoggedHours = clientId
    ? (timeLogTotalsByClient.get(clientId) ?? 0)
    : 0
  const totalClientRemainingHours =
    totalClientPurchasedHours - totalClientLoggedHours
  const lastLogAt = projectLogSummary?.lastLogAt ?? null

  return {
    totalClientPurchasedHours,
    totalClientLoggedHours,
    totalClientRemainingHours,
    totalProjectLoggedHours,
    lastLogAt,
  }
}

function buildClientLogTotals(
  timeLogSummaries: Map<string, TimeLogSummary>,
  projectClientLookup: Map<string, string | null>
): Map<string, number> {
  const totals = new Map<string, number>()

  timeLogSummaries.forEach((summary, projectId) => {
    const clientId = projectClientLookup.get(projectId) ?? null
    if (!clientId) {
      return
    }

    const existingTotal = totals.get(clientId) ?? 0
    totals.set(clientId, existingTotal + summary.totalHours)
  })

  return totals
}
