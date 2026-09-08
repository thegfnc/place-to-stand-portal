import 'server-only'

import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin, ensureProjectAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { taskAssignees, tasks } from '@/lib/db/schema'
import type { RawTaskWithRelations } from '@/lib/data/projects/types'

type TaskWithRelationsSelection = {
  id: string
  projectId: string
  leadId: string | null
  title: string
  description: string | null
  status: RawTaskWithRelations['status']
  rank: string
  acceptedAt: string | null
  completedAt: string | null
  dueOn: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  githubIssueNumber: number | null
  githubIssueUrl: string | null
  workerStatus: string | null
  commentCount: number
  attachmentCount: number
  loggedHours: string | number | null
}

type TaskAssigneeSelection = {
  taskId: string
  userId: string
  deletedAt: string | null
}

export type ProjectTaskCollections = {
  active: RawTaskWithRelations[]
  accepted: RawTaskWithRelations[]
  archived: RawTaskWithRelations[]
}

async function listProjectTasksWithRelations(
  user: AppUser,
  projectId: string,
  options: { includeArchived?: boolean } = {}
): Promise<RawTaskWithRelations[]> {
  await ensureProjectAccess(user, projectId)

  const whereClause = options.includeArchived
    ? eq(tasks.projectId, projectId)
    : and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt))

  return queryTasksWithRelations(whereClause, asc(tasks.rank))
}

/**
 * Tasks linked to a lead, hydrated with the same counts and assignee rows the
 * project board's cards consume — the lead sheet renders the board's card.
 * Admin-asserted like `listTasksForLead` (leads are admin-only, no RLS).
 * Ordered by creation so the section reads as a chronology, not board rank.
 */
export async function listLeadTasksWithRelations(
  user: AppUser,
  leadId: string
): Promise<RawTaskWithRelations[]> {
  assertAdmin(user)

  return queryTasksWithRelations(
    and(eq(tasks.leadId, leadId), isNull(tasks.deletedAt)),
    asc(tasks.createdAt)
  )
}

async function queryTasksWithRelations(
  whereClause: SQL | undefined,
  orderBy: SQL
): Promise<RawTaskWithRelations[]> {
  const taskRows = (await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      leadId: tasks.leadId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      rank: tasks.rank,
      acceptedAt: tasks.acceptedAt,
      completedAt: tasks.completedAt,
      dueOn: tasks.dueOn,
      createdBy: tasks.createdBy,
      updatedBy: tasks.updatedBy,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      deletedAt: tasks.deletedAt,
      githubIssueNumber: tasks.githubIssueNumber,
      githubIssueUrl: tasks.githubIssueUrl,
      workerStatus: tasks.workerStatus,
      // Raw aliased SQL, deliberately: drizzle strips table qualification from
      // columns interpolated into projection fragments, so `${timeLogs.id}`
      // renders as a bare "id" — ambiguous inside the join below. Aliases keep
      // every reference qualified without interpolation.
      commentCount: sql<number>`(
        select coalesce(count(*), 0)
        from task_comments tc
        where tc.task_id = tasks.id
          and tc.deleted_at is null
      )`,
      attachmentCount: sql<number>`(
        select coalesce(count(*), 0)
        from task_attachments ta
        where ta.task_id = tasks.id
          and ta.deleted_at is null
      )`,
      loggedHours: sql<string>`(
        select coalesce(sum(tl.hours), 0)
        from time_log_tasks tlt
        join time_logs tl on tl.id = tlt.time_log_id
        where tlt.task_id = tasks.id
          and tlt.deleted_at is null
          and tl.deleted_at is null
      )`,
    })
    .from(tasks)
    .where(whereClause)
    .orderBy(orderBy)) as TaskWithRelationsSelection[]

  if (!taskRows.length) {
    return []
  }

  const taskIds = taskRows.map(row => row.id)

  const assigneeRows = (await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
      deletedAt: taskAssignees.deletedAt,
    })
    .from(taskAssignees)
    .where(
      and(
        inArray(taskAssignees.taskId, taskIds),
        isNull(taskAssignees.deletedAt)
      )
    )) as TaskAssigneeSelection[]

  const assigneesByTask = new Map<string, RawTaskWithRelations['assignees']>()
  assigneeRows.forEach(row => {
    const list = assigneesByTask.get(row.taskId) ?? []
    list.push({ user_id: row.userId, deleted_at: row.deletedAt })
    assigneesByTask.set(row.taskId, list)
  })

  return taskRows.map(row => ({
    id: row.id,
    project_id: row.projectId,
    lead_id: row.leadId,
    title: row.title ?? '',
    description: row.description,
    status: row.status ?? 'ON_DECK',
    rank: row.rank,
    accepted_at: row.acceptedAt,
    completed_at: row.completedAt,
    due_on: row.dueOn,
    created_by: row.createdBy ?? null,
    updated_by: row.updatedBy ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    github_issue_number: row.githubIssueNumber,
    github_issue_url: row.githubIssueUrl,
    worker_status: row.workerStatus as RawTaskWithRelations['worker_status'],
    assignees: assigneesByTask.get(row.id) ?? [],
    comment_count: Number(row.commentCount ?? 0),
    attachment_count: Number(row.attachmentCount ?? 0),
    logged_hours: Number(row.loggedHours ?? 0),
  }))
}

export async function listProjectTaskCollectionsWithRelations(
  user: AppUser,
  projectId: string
): Promise<ProjectTaskCollections> {
  const rows = await listProjectTasksWithRelations(user, projectId, {
    includeArchived: true,
  })

  const active = rows.filter(task => !task.deleted_at)
  const archived = rows
    .filter(task => Boolean(task.deleted_at))
    .sort((a, b) => {
      const aTime = a.deleted_at ? Date.parse(a.deleted_at) : 0
      const bTime = b.deleted_at ? Date.parse(b.deleted_at) : 0
      return bTime - aTime
    })

  const accepted = active
    .filter(task => task.status === 'DONE' && Boolean(task.accepted_at))
    .sort((a, b) => {
      const aTime = a.accepted_at ? Date.parse(a.accepted_at) : 0
      const bTime = b.accepted_at ? Date.parse(b.accepted_at) : 0
      return bTime - aTime
    })

  return {
    active,
    accepted,
    archived,
  }
}
