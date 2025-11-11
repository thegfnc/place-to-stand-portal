import 'server-only'

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureClientAccessByProjectId,
  ensureClientAccessByTimeLogId,
  isAdmin,
} from '@/lib/auth/permissions'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { db } from '@/lib/db'
import {
  tasks,
  timeLogTasks,
  timeLogs,
  users,
} from '@/lib/db/schema'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'
import type { DbTimeLog } from '@/lib/types'
import type { TimeLogSummary } from '@/lib/data/projects/types'
import type { Database } from '@/lib/supabase/types'

const DEFAULT_HISTORY_LIMIT = 10

type ProjectTimeLogAggregateRow = {
  projectId: string
  totalHours: string | null
  lastLogAt: string | null
}

type SumOfHoursRow = {
  totalHours: string | null
}

export async function getSumOfHoursForProject(
  projectId: string,
): Promise<number> {
  const [row] = await db
    .select({
      totalHours: sql<string | null>`COALESCE(SUM(${timeLogs.hours}), '0')`,
    })
    .from(timeLogs)
    .where(and(eq(timeLogs.projectId, projectId), isNull(timeLogs.deletedAt)))
    .limit(1) as SumOfHoursRow[]

  const total = row?.totalHours ?? '0'
  const parsed = Number(total)

  return Number.isFinite(parsed) ? parsed : 0
}

export async function getTimeLogSummariesForProjects(
  projectIds: readonly string[],
): Promise<Map<string, TimeLogSummary>> {
  if (!projectIds.length) {
    return new Map()
  }

  const rows = (await db
    .select({
      projectId: timeLogs.projectId,
      totalHours: sql<string | null>`SUM(${timeLogs.hours})`,
      lastLogAt: sql<string | null>`MAX(${timeLogs.loggedOn})`,
    })
    .from(timeLogs)
    .where(
      and(inArray(timeLogs.projectId, projectIds), isNull(timeLogs.deletedAt)),
    )
    .groupBy(timeLogs.projectId)) as ProjectTimeLogAggregateRow[]

  const summaries = new Map<string, TimeLogSummary>()

  rows.forEach(row => {
    const total = Number(row.totalHours ?? '0')
    summaries.set(row.projectId, {
      totalHours: Number.isFinite(total) ? total : 0,
      lastLogAt: row.lastLogAt ?? null,
    })
  })

  return summaries
}

export type CreateTimeLogInput = {
  projectId: string
  userId: string
  hours: number
  loggedOn: string
  note: string | null
  taskIds: string[]
}

export type ProjectTimeLogList = {
  logs: TimeLogEntry[]
  totalCount: number
}

type TimeLogSelection = {
  log: {
    id: string
    projectId: string
    userId: string
    hours: string | null
    loggedOn: string
    note: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
  }
  user: {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    role: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
  } | null
}

type TimeLogTaskSelection = {
  id: string
  timeLogId: string
  deletedAt: string | null
  task: {
    id: string
    title: string | null
    status: string | null
    deletedAt: string | null
  } | null
}

type DbTimeLogSelection = {
  id: string
  projectId: string
  userId: string
  hours: string | null
  loggedOn: string
  note: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export async function listProjectTimeLogs(
  user: AppUser,
  projectId: string,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<ProjectTimeLogList> {
  await ensureClientAccessByProjectId(user, projectId)

  const effectiveLimit = Math.max(1, Math.min(limit, 200))

  const timeLogRows = (await db
    .select({
      log: {
        id: timeLogs.id,
        projectId: timeLogs.projectId,
        userId: timeLogs.userId,
        hours: timeLogs.hours,
        loggedOn: timeLogs.loggedOn,
        note: timeLogs.note,
        createdAt: timeLogs.createdAt,
        updatedAt: timeLogs.updatedAt,
        deletedAt: timeLogs.deletedAt,
      },
      user: {
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
      },
    })
    .from(timeLogs)
    .leftJoin(users, eq(timeLogs.userId, users.id))
    .where(and(eq(timeLogs.projectId, projectId), isNull(timeLogs.deletedAt)))
    .orderBy(desc(timeLogs.loggedOn), desc(timeLogs.createdAt))
    .limit(effectiveLimit)) as TimeLogSelection[]

  const timeLogIds = timeLogRows.map(row => row.log.id)

  const linkedTaskRows: TimeLogTaskSelection[] = timeLogIds.length
    ? await db
        .select({
          id: timeLogTasks.id,
          timeLogId: timeLogTasks.timeLogId,
          deletedAt: timeLogTasks.deletedAt,
          task: {
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
            deletedAt: tasks.deletedAt,
          },
        })
        .from(timeLogTasks)
        .leftJoin(tasks, eq(timeLogTasks.taskId, tasks.id))
        .where(inArray(timeLogTasks.timeLogId, timeLogIds))
    : []

  const linkedTasksByLog = new Map<string, TimeLogEntry['linked_tasks']>()

  for (const link of linkedTaskRows) {
    const existing = linkedTasksByLog.get(link.timeLogId) ?? []
    existing.push({
      id: link.id,
      deleted_at: link.deletedAt,
      task: link.task
        ? {
            id: link.task.id,
            title: link.task.title,
            status: link.task.status,
            deleted_at: link.task.deletedAt,
          }
        : null,
    })
    linkedTasksByLog.set(link.timeLogId, existing)
  }

  const logs = timeLogRows.map(row => ({
    id: row.log.id,
    project_id: row.log.projectId,
    user_id: row.log.userId,
    hours: Number(row.log.hours ?? '0'),
    logged_on: row.log.loggedOn,
    note: row.log.note,
    created_at: row.log.createdAt,
    updated_at: row.log.updatedAt,
    deleted_at: row.log.deletedAt,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          full_name: row.user.fullName,
          avatar_url: row.user.avatarUrl,
          role: row.user.role as Database['public']['Enums']['user_role'],
          created_at: row.user.createdAt,
          updated_at: row.user.updatedAt,
          deleted_at: row.user.deletedAt,
        }
      : null,
    linked_tasks: linkedTasksByLog.get(row.log.id) ?? [],
  }))

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(timeLogs)
    .where(and(eq(timeLogs.projectId, projectId), isNull(timeLogs.deletedAt)))

  return {
    logs,
    totalCount: Number(count ?? 0),
  }
}

export async function createTimeLog(
  user: AppUser,
  input: CreateTimeLogInput,
): Promise<string> {
  const { projectId, userId, hours, loggedOn, note, taskIds } = input

  await ensureClientAccessByProjectId(user, projectId)

  if (!isAdmin(user) && user.id !== userId) {
    throw new ForbiddenError('Insufficient permissions to log time for this user')
  }

  const hoursValue = hours.toString()
  const noteValue = note && note.trim().length ? note.trim() : null

  return db.transaction(async tx => {
    const [inserted] = await tx
      .insert(timeLogs)
      .values({
        projectId,
        userId,
        hours: hoursValue,
        loggedOn,
        note: noteValue,
      })
      .returning({ id: timeLogs.id })

    if (!inserted) {
      throw new Error('Unable to create time log entry.')
    }

    if (taskIds.length) {
      const values = taskIds.map(taskId => ({
        timeLogId: inserted.id,
        taskId,
      }))
      await tx.insert(timeLogTasks).values(values)
    }

    return inserted.id
  })
}

export async function softDeleteTimeLog(
  user: AppUser,
  projectId: string,
  timeLogId: string,
): Promise<void> {
  const rows = await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
      userId: timeLogs.userId,
      deletedAt: timeLogs.deletedAt,
    })
    .from(timeLogs)
    .where(eq(timeLogs.id, timeLogId))
    .limit(1)

  if (!rows.length) {
    throw new NotFoundError('Time log not found')
  }

  const [timeLog] = rows

  if (timeLog.projectId !== projectId) {
    throw new NotFoundError('Time log not found for project')
  }

  await ensureClientAccessByProjectId(user, projectId)

  if (!isAdmin(user) && timeLog.userId !== user.id) {
    throw new ForbiddenError('Insufficient permissions to delete this time log')
  }

  if (timeLog.deletedAt) {
    return
  }

  await db
    .update(timeLogs)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(timeLogs.id, timeLogId))
}

export async function getTimeLogById(
  user: AppUser,
  timeLogId: string,
): Promise<DbTimeLog> {
  await ensureClientAccessByTimeLogId(user, timeLogId)

  const rows = (await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
      userId: timeLogs.userId,
      hours: timeLogs.hours,
      loggedOn: timeLogs.loggedOn,
      note: timeLogs.note,
      createdAt: timeLogs.createdAt,
      updatedAt: timeLogs.updatedAt,
      deletedAt: timeLogs.deletedAt,
    })
    .from(timeLogs)
    .where(eq(timeLogs.id, timeLogId))
    .limit(1)) as DbTimeLogSelection[]

  if (!rows.length) {
    throw new NotFoundError('Time log not found')
  }

  return mapDbTimeLogSelection(rows[0]!)
}

function mapDbTimeLogSelection(selection: DbTimeLogSelection): DbTimeLog {
  return {
    id: selection.id,
    project_id: selection.projectId,
    user_id: selection.userId,
    hours: Number(selection.hours ?? '0'),
    logged_on: selection.loggedOn,
    note: selection.note,
    created_at: selection.createdAt,
    updated_at: selection.updatedAt,
    deleted_at: selection.deletedAt,
  }
}
