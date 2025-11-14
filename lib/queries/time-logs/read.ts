import 'server-only'

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureClientAccessByProjectId,
  ensureClientAccessByTimeLogId,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  tasks,
  timeLogTasks,
  timeLogs,
  users,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'
import type { DbTimeLog } from '@/lib/types'
import type { UserRoleValue } from '@/lib/types'

const DEFAULT_HISTORY_LIMIT = 10

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

export type ProjectTimeLogList = {
  logs: TimeLogEntry[]
  totalCount: number
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
          role: row.user.role as UserRoleValue,
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

