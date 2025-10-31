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
  const { membersByProject, accessibleProjectIds } = organizeMembers(
    relations.members,
    options.forUserId ?? null
  )
  const accessibleClientIds = buildAccessibleClientIds(
    relations.clientMemberships
  )
  const purchasedHoursByClient = tallyPurchasedHours(relations.hourBlocks)
  const { timeLogTotalsByProject, timeLogTotalsByClient } = summarizeTimeLogs(
    relations.timeLogs,
    projectClientLookup
  )
  const tasksByProject = groupTasksByProject(relations.tasks)

  const scopedProjects =
    shouldScopeToUser && options.forUserId
      ? scopeProjects(projects, accessibleProjectIds, accessibleClientIds)
      : projects

  return scopedProjects.map(project => ({
    ...project,
    client: project.client_id
      ? (clientLookup.get(project.client_id) ?? null)
      : null,
    members: membersByProject.get(project.id) ?? [],
    tasks: tasksByProject.get(project.id) ?? [],
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
  userId: string | null
): {
  membersByProject: Map<string, ProjectMemberWithUser[]>
  accessibleProjectIds: Set<string>
} {
  const membersByProject = new Map<string, ProjectMemberWithUser[]>()
  const accessibleProjectIds = new Set<string>()

  members.forEach(member => {
    if (
      !member ||
      member.deleted_at ||
      !member.user ||
      member.user.deleted_at
    ) {
      return
    }

    if (userId && member.user_id === userId) {
      accessibleProjectIds.add(member.project_id)
    }

    const memberList = membersByProject.get(member.project_id) ?? []
    memberList.push({ ...member, user: member.user })
    membersByProject.set(member.project_id, memberList)
  })

  return { membersByProject, accessibleProjectIds }
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

function groupTasksByProject(
  tasks: RawTaskWithRelations[]
): Map<string, TaskWithRelations[]> {
  const tasksByProject = new Map<string, TaskWithRelations[]>()

  tasks.forEach(task => {
    if (!task || task.deleted_at) {
      return
    }

    const {
      assignees: rawAssignees,
      comments,
      attachments,
      ...taskFields
    } = task

    const safeAssignees = (rawAssignees ?? [])
      .filter(assignee => !assignee.deleted_at)
      .map(assignee => ({ user_id: assignee.user_id }))

    const commentCount = (comments ?? []).filter(
      comment => comment && !comment.deleted_at
    ).length

    const safeAttachments = (attachments ?? []).filter(
      attachment => attachment && !attachment.deleted_at
    )

    const existingTasks = tasksByProject.get(task.project_id) ?? []
    existingTasks.push({
      ...taskFields,
      assignees: safeAssignees,
      commentCount,
      attachments: safeAttachments,
    })
    tasksByProject.set(task.project_id, existingTasks)
  })

  return tasksByProject
}

function scopeProjects(
  projects: DbProject[],
  accessibleProjectIds: Set<string>,
  accessibleClientIds: Set<string>
): DbProject[] {
  return projects.filter(project => {
    if (accessibleProjectIds.has(project.id)) {
      return true
    }

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
