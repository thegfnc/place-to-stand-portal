import 'server-only'

import { cache } from 'react'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { UserRole } from '@/lib/auth/session'
import type {
  DbClient,
  DbProject,
  DbProjectMember,
  DbTask,
  DbTimeLog,
  DbUser,
  ProjectMemberWithUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'

type FetchProjectsWithRelationsOptions = {
  forUserId?: string
  forRole?: UserRole
}

export const fetchProjectsWithRelations = cache(
  async (
    options: FetchProjectsWithRelationsOptions = {}
  ): Promise<ProjectWithRelations[]> => {
    const supabase = getSupabaseServiceClient()

    const { data: projectRows, error: projectsError } = await supabase
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

    if (projectsError) {
      console.error('Failed to load projects', projectsError)
      throw projectsError
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

    const shouldScopeToUser =
      options.forRole !== 'ADMIN' && Boolean(options.forUserId)

    const clientsPromise = clientIds.length
      ? supabase
          .from('clients')
          .select(
            `
            id,
            name,
            slug,
            notes,
            created_at,
            updated_at,
            deleted_at
          `
          )
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null })

    const membersPromise = projectIds.length
      ? supabase
          .from('project_members')
          .select(
            `
            id,
            project_id,
            user_id,
            role,
            created_at,
            deleted_at,
            user:users (
              id,
              email,
              full_name,
              role,
              avatar_url,
              created_at,
              updated_at,
              deleted_at
            )
          `
          )
          .in('project_id', projectIds)
      : Promise.resolve({ data: [], error: null })

    const tasksPromise = projectIds.length
      ? supabase
          .from('tasks')
          .select(
            `
            id,
            project_id,
            title,
            description,
            status,
            due_on,
            created_by,
            updated_by,
            created_at,
            updated_at,
            deleted_at,
            assignees:task_assignees (
              user_id,
              deleted_at
            ),
            comments:task_comments (
              id,
              deleted_at
            ),
            attachments:task_attachments (
              id,
              task_id,
              storage_path,
              original_name,
              mime_type,
              file_size,
              uploaded_by,
              created_at,
              updated_at,
              deleted_at
            )
          `
          )
          .in('project_id', projectIds)
      : Promise.resolve({ data: [], error: null })

    const hourBlocksPromise = clientIds.length
      ? supabase
          .from('hour_blocks')
          .select(
            `
            id,
            client_id,
            hours_purchased,
            deleted_at
          `
          )
          .in('client_id', clientIds)
      : Promise.resolve({ data: [], error: null })

    const timeLogsPromise = projectIds.length
      ? supabase
          .from('time_logs')
          .select(
            `
            id,
            project_id,
            hours,
            logged_on,
            deleted_at
          `
          )
          .in('project_id', projectIds)
      : Promise.resolve({ data: [], error: null })

    const clientMembershipsPromise =
      shouldScopeToUser && options.forUserId
        ? supabase
            .from('client_members')
            .select('client_id, deleted_at')
            .eq('user_id', options.forUserId)
        : Promise.resolve({ data: [], error: null })

    const [
      { data: clientsData, error: clientsError },
      { data: membersData, error: membersError },
      { data: tasksData, error: tasksError },
      { data: hourBlocksData, error: hourBlocksError },
      { data: timeLogsData, error: timeLogsError },
      { data: clientMembershipsData, error: clientMembershipsError },
    ] = await Promise.all([
      clientsPromise,
      membersPromise,
      tasksPromise,
      hourBlocksPromise,
      timeLogsPromise,
      clientMembershipsPromise,
    ])

    if (clientsError) {
      console.error('Failed to load project clients', clientsError)
      throw clientsError
    }

    if (membersError) {
      console.error('Failed to load project members', membersError)
      throw membersError
    }

    if (tasksError) {
      console.error('Failed to load project tasks', tasksError)
      throw tasksError
    }

    if (hourBlocksError) {
      console.error('Failed to load hour blocks for burndown', hourBlocksError)
      throw hourBlocksError
    }

    if (timeLogsError) {
      console.error('Failed to load time logs for burndown', timeLogsError)
      throw timeLogsError
    }

    if (clientMembershipsError) {
      console.error(
        'Failed to load client memberships for scoping',
        clientMembershipsError
      )
      throw clientMembershipsError
    }

    const clientLookup = new Map<string, DbClient>()
    ;(clientsData as DbClient[]).forEach(client => {
      clientLookup.set(client.id, client)
    })

    const accessibleProjectIds = new Set<string>()
    const membersByProject = new Map<string, ProjectMemberWithUser[]>()
    ;(
      (membersData ?? []) as Array<DbProjectMember & { user: DbUser | null }>
    ).forEach(member => {
      if (
        !member ||
        member.deleted_at ||
        !member.user ||
        member.user.deleted_at
      ) {
        return
      }

      if (options.forUserId && member.user_id === options.forUserId) {
        accessibleProjectIds.add(member.project_id)
      }

      const list = membersByProject.get(member.project_id) ?? []
      list.push({ ...member, user: member.user })
      membersByProject.set(member.project_id, list)
    })

    const accessibleClientIds = new Set<string>()
    ;(clientMembershipsData ?? []).forEach(entry => {
      if (!entry || entry.deleted_at || !entry.client_id) {
        return
      }
      accessibleClientIds.add(entry.client_id)
    })

    const purchasedHoursByClient = new Map<string, number>()
    ;(hourBlocksData ?? []).forEach(block => {
      if (!block || block.deleted_at || !block.client_id) {
        return
      }
      const total = purchasedHoursByClient.get(block.client_id) ?? 0
      purchasedHoursByClient.set(
        block.client_id,
        total + Number(block.hours_purchased)
      )
    })

    const timeLogTotalsByProject = new Map<
      string,
      { totalHours: number; lastLogAt: string | null }
    >()
    const timeLogTotalsByClient = new Map<string, number>()
    ;(timeLogsData ?? []).forEach(raw => {
      const log = raw as DbTimeLog
      if (!log || log.deleted_at || !log.project_id) {
        return
      }

      const current = timeLogTotalsByProject.get(log.project_id) ?? {
        totalHours: 0,
        lastLogAt: null as string | null,
      }

      const nextTotal = current.totalHours + Number(log.hours ?? 0)
      const nextLastLogAt = current.lastLogAt
        ? current.lastLogAt >= (log.logged_on ?? '')
          ? current.lastLogAt
          : (log.logged_on ?? null)
        : (log.logged_on ?? null)

      timeLogTotalsByProject.set(log.project_id, {
        totalHours: nextTotal,
        lastLogAt: nextLastLogAt,
      })

      const clientId = projectClientLookup.get(log.project_id) ?? null
      if (clientId) {
        const clientTotal = timeLogTotalsByClient.get(clientId) ?? 0
        timeLogTotalsByClient.set(
          clientId,
          clientTotal + Number(log.hours ?? 0)
        )
      }
    })

    const scopedProjects =
      shouldScopeToUser && options.forUserId
        ? projects.filter(project => {
            if (accessibleProjectIds.has(project.id)) {
              return true
            }

            if (
              project.client_id &&
              accessibleClientIds.has(project.client_id)
            ) {
              return true
            }

            return false
          })
        : projects

    const tasksByProject = new Map<string, TaskWithRelations[]>()
    ;(
      tasksData as Array<
        DbTask & {
          assignees: Array<{
            user_id: string
            deleted_at: string | null
          }> | null
          comments: Array<{
            id: string
            deleted_at: string | null
          }> | null
          attachments: Array<{
            id: string
            task_id: string
            storage_path: string
            original_name: string
            mime_type: string
            file_size: number
            uploaded_by: string
            created_at: string
            updated_at: string
            deleted_at: string | null
          }> | null
        }
      >
    ).forEach(task => {
      if (!task || task.deleted_at) {
        return
      }
      const list = tasksByProject.get(task.project_id) ?? []
      const { assignees: rawAssignees, comments, ...taskFields } = task
      const commentCount = (comments ?? []).filter(
        comment => comment && !comment.deleted_at
      ).length

      list.push({
        ...taskFields,
        assignees: (rawAssignees ?? [])
          .filter(assignee => !assignee.deleted_at)
          .map(assignee => ({ user_id: assignee.user_id })),
        commentCount,
        attachments: (task.attachments ?? []).filter(
          attachment => attachment && !attachment.deleted_at
        ),
      })
      tasksByProject.set(task.project_id, list)
    })

    return scopedProjects.map(project => ({
      ...project,
      client: project.client_id
        ? (clientLookup.get(project.client_id) ?? null)
        : null,
      members: membersByProject.get(project.id) ?? [],
      tasks: tasksByProject.get(project.id) ?? [],
      burndown: (() => {
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
      })(),
    }))
  }
)
