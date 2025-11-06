import type { UserRole } from '@/lib/auth/session'
import type {
  DbClient,
  DbProject,
  DbTimeLog,
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
}

export function assembleProjectsWithRelations({
  projects,
  projectClientLookup,
  options,
  shouldScopeToUser,
  relations,
}: AssembleProjectsArgs): ProjectWithRelations[] {
  const clientLookup = buildClientLookup(relations.clients)
  const membersByProject = organizeMembers(relations.members)
  const accessibleClientIds = buildAccessibleClientIds(
    relations.clientMemberships
  )
  const purchasedHoursByClient = tallyPurchasedHours(relations.hourBlocks)
  const { timeLogTotalsByProject, timeLogTotalsByClient } = summarizeTimeLogs(
    relations.timeLogs,
    projectClientLookup
  )
  const { activeTasksByProject, archivedTasksByProject } = groupTasksByProject(
    relations.tasks
  )

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
  members: MemberWithUser[]
): Map<string, ProjectMemberWithUser[]> {
  const membersByProject = new Map<string, ProjectMemberWithUser[]>()

  members.forEach(member => {
    if (
      !member ||
      member.deleted_at ||
      !member.user ||
      member.user.deleted_at
    ) {
      return
    }

    const memberList = membersByProject.get(member.project_id) ?? []
    memberList.push({ ...member, user: member.user })
    membersByProject.set(member.project_id, memberList)
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

function summarizeTimeLogs(
  logs: DbTimeLog[],
  projectClientLookup: Map<string, string | null>
): {
  timeLogTotalsByProject: Map<string, TimeLogSummary>
  timeLogTotalsByClient: Map<string, number>
} {
  const timeLogTotalsByProject = new Map<string, TimeLogSummary>()
  const timeLogTotalsByClient = new Map<string, number>()

  logs.forEach(rawLog => {
    const log = rawLog
    if (!log || log.deleted_at || !log.project_id) {
      return
    }

    const existing = timeLogTotalsByProject.get(log.project_id) ?? {
      totalHours: 0,
      lastLogAt: null as string | null,
    }

    const nextTotal = existing.totalHours + Number(log.hours ?? 0)
    const nextLastLogAt = existing.lastLogAt
      ? existing.lastLogAt >= (log.logged_on ?? '')
        ? existing.lastLogAt
        : (log.logged_on ?? null)
      : (log.logged_on ?? null)

    timeLogTotalsByProject.set(log.project_id, {
      totalHours: nextTotal,
      lastLogAt: nextLastLogAt,
    })

    const clientId = projectClientLookup.get(log.project_id) ?? null
    if (clientId) {
      const clientTotal = timeLogTotalsByClient.get(clientId) ?? 0
      timeLogTotalsByClient.set(clientId, clientTotal + Number(log.hours ?? 0))
    }
  })

  return { timeLogTotalsByProject, timeLogTotalsByClient }
}

function groupTasksByProject(tasks: RawTaskWithRelations[]): {
  activeTasksByProject: Map<string, TaskWithRelations[]>
  archivedTasksByProject: Map<string, TaskWithRelations[]>
} {
  const activeTasksByProject = new Map<string, TaskWithRelations[]>()
  const archivedTasksByProject = new Map<string, TaskWithRelations[]>()

  tasks.forEach(task => {
    if (!task || !task.project_id) {
      return
    }

    const normalizedTask = normalizeRawTask(task)

    const targetMap = task.deleted_at
      ? archivedTasksByProject
      : activeTasksByProject

    const existingTasks = targetMap.get(task.project_id) ?? []
    existingTasks.push(normalizedTask)
    targetMap.set(task.project_id, existingTasks)
  })

  return { activeTasksByProject, archivedTasksByProject }
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
