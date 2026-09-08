import 'server-only'

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureProjectAccess,
  ensureTaskAccess,
  ensureTimeLogAccess,
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
export type ProjectTimeLogList = {
  logs: TimeLogEntry[]
  totalCount: number
}

export type TaskTimeLogList = {
  entries: TimeLogEntry[]
  totalHours: number
}

const TIME_LOG_SELECTION = {
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
}

/**
 * Shared hydration for time-log rows: fetches each log's linked tasks and
 * maps everything into `TimeLogEntry` shape. Soft-deleted links are filtered
 * out here (`timeLogTasks.deletedAt IS NULL`) — the previous inline query in
 * `listProjectTimeLogs` missed that filter, so the edit dialog re-selected
 * previously unlinked tasks.
 */
async function hydrateTimeLogEntries(
  timeLogRows: TimeLogSelection[],
): Promise<TimeLogEntry[]> {
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
        .where(
          and(
            inArray(timeLogTasks.timeLogId, timeLogIds),
            isNull(timeLogTasks.deletedAt),
          ),
        )
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

  return timeLogRows.map(row => ({
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
}

export async function listProjectTimeLogs(
  user: AppUser,
  projectId: string,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<ProjectTimeLogList> {
  await ensureProjectAccess(user, projectId)

  const effectiveLimit = Math.max(1, Math.min(limit, 200))

  const timeLogRows = (await db
    .select(TIME_LOG_SELECTION)
    .from(timeLogs)
    .leftJoin(users, eq(timeLogs.userId, users.id))
    .where(and(eq(timeLogs.projectId, projectId), isNull(timeLogs.deletedAt)))
    .orderBy(desc(timeLogs.loggedOn), desc(timeLogs.createdAt))
    .limit(effectiveLimit)) as TimeLogSelection[]

  const logs = await hydrateTimeLogEntries(timeLogRows)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(timeLogs)
    .where(and(eq(timeLogs.projectId, projectId), isNull(timeLogs.deletedAt)))

  return {
    logs,
    totalCount: Number(count ?? 0),
  }
}

/**
 * All non-deleted time logs linked to a task, newest first, with a SQL-summed
 * total. The admin guard lives inside the query (`ensureTaskAccess`, which
 * asserts admin transitively via `ensureProjectAccess`) so any future
 * server-side caller inherits it rather than relying on the route.
 */
export async function listTaskTimeLogs(
  user: AppUser,
  taskId: string,
): Promise<TaskTimeLogList> {
  // Default access check: soft-deleted tasks 404 (status-ARCHIVED tasks are
  // not soft-deleted, so their sheets can still show existing logs).
  await ensureTaskAccess(user, taskId)

  const timeLogRows = (await db
    .select(TIME_LOG_SELECTION)
    .from(timeLogTasks)
    .innerJoin(timeLogs, eq(timeLogTasks.timeLogId, timeLogs.id))
    .leftJoin(users, eq(timeLogs.userId, users.id))
    .where(
      and(
        eq(timeLogTasks.taskId, taskId),
        isNull(timeLogTasks.deletedAt),
        isNull(timeLogs.deletedAt),
      ),
    )
    .orderBy(
      desc(timeLogs.loggedOn),
      desc(timeLogs.createdAt),
    )) as TimeLogSelection[]

  const entries = await hydrateTimeLogEntries(timeLogRows)

  // numeric(8,2) values arrive as strings — sum in SQL, not JS floats.
  const [{ totalHours }] = await db
    .select({
      totalHours: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
    })
    .from(timeLogTasks)
    .innerJoin(timeLogs, eq(timeLogTasks.timeLogId, timeLogs.id))
    .where(
      and(
        eq(timeLogTasks.taskId, taskId),
        isNull(timeLogTasks.deletedAt),
        isNull(timeLogs.deletedAt),
      ),
    )

  return {
    entries,
    totalHours: Number(totalHours ?? 0),
  }
}

/**
 * One time log in full `TimeLogEntry` shape (author + linked tasks), by id.
 *
 * The dashboard's hours widget lists logs in a lean shape and fetches this
 * only when a row is opened for editing, so the list payload stays small and
 * the edit path still gets everything the dialog needs.
 */
export async function getTimeLogEntryById(
  user: AppUser,
  timeLogId: string,
): Promise<TimeLogEntry> {
  await ensureTimeLogAccess(user, timeLogId)

  const timeLogRows = (await db
    .select(TIME_LOG_SELECTION)
    .from(timeLogs)
    .leftJoin(users, eq(timeLogs.userId, users.id))
    .where(and(eq(timeLogs.id, timeLogId), isNull(timeLogs.deletedAt)))
    .limit(1)) as TimeLogSelection[]

  if (!timeLogRows.length) {
    throw new NotFoundError('Time log not found')
  }

  const [entry] = await hydrateTimeLogEntries(timeLogRows)

  if (!entry) {
    throw new NotFoundError('Time log not found')
  }

  return entry
}
