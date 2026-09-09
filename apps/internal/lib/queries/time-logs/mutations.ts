import 'server-only'

import { eq, inArray } from 'drizzle-orm'

import {
  timeLogCreatedEvent,
  timeLogDeletedEvent,
  timeLogUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { ensureProjectAccess } from '@/lib/auth/permissions'
import { HttpError, NotFoundError } from '@/lib/errors/http'
import { db } from '@/lib/db'
import {
  projects,
  tasks,
  timeLogTasks,
  timeLogs,
} from '@/lib/db/schema'
import type { ActivitySourceValue } from '@/lib/types'

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Server-side eligibility check for linked tasks (the client-side filter and
 * disabled button are advisory only): every linked task must exist, belong to
 * the log's project, not be soft-deleted, and not be status ARCHIVED.
 * Accepted tasks are explicitly allowed — the task sheet pre-links them.
 * Runs inside the mutation transaction so a task archived after the dialog
 * opened still fails cleanly with a 400.
 */
async function assertLinkedTasksEligible(
  tx: TransactionClient,
  projectId: string,
  taskIds: string[],
): Promise<void> {
  if (!taskIds.length) {
    return
  }

  // FOR UPDATE locks the task rows through the link write, so a concurrent
  // archive/soft-delete between this check and the insert can't slip an
  // ineligible link through (READ COMMITTED TOCTOU).
  const rows = await tx
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      status: tasks.status,
      deletedAt: tasks.deletedAt,
    })
    .from(tasks)
    .where(inArray(tasks.id, taskIds))
    .for('update')

  const rowsById = new Map(rows.map(row => [row.id, row]))

  for (const taskId of taskIds) {
    const row = rowsById.get(taskId)

    if (!row || row.projectId !== projectId || row.deletedAt !== null) {
      throw new HttpError(
        'One or more linked tasks are no longer available.',
        400,
      )
    }
  }
}

/**
 * Time-log mutations are the single write path for the browser routes (and
 * any future CLI route), so the activity row is written here rather than by
 * each caller. Only the source is caller-specific.
 */
export type TimeLogMutationOptions = {
  source?: ActivitySourceValue
}

type TimeLogProjectContext = {
  name: string | null
  clientId: string | null
}

async function getTimeLogProjectContext(
  projectId: string
): Promise<TimeLogProjectContext> {
  const rows = await db
    .select({ name: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  return {
    name: rows[0]?.name ?? null,
    clientId: rows[0]?.clientId ?? null,
  }
}

async function getLinkedTaskIds(timeLogId: string): Promise<string[]> {
  const rows = await db
    .select({ taskId: timeLogTasks.taskId })
    .from(timeLogTasks)
    .where(eq(timeLogTasks.timeLogId, timeLogId))

  return rows.map(row => row.taskId).sort()
}

const sameIdSet = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false
  }

  const sortedRight = [...right].sort()

  return [...left].sort().every((id, index) => id === sortedRight[index])
}

export type CreateTimeLogInput = {
  projectId: string
  userId: string
  hours: number
  loggedOn: string
  note: string | null
  taskIds: string[]
}

export type UpdateTimeLogInput = {
  projectId: string
  timeLogId: string
  userId: string
  hours: number
  loggedOn: string
  note: string | null
  taskIds: string[]
}

export async function createTimeLog(
  user: AppUser,
  input: CreateTimeLogInput,
  options: TimeLogMutationOptions = {},
): Promise<string> {
  const { projectId, userId, hours, loggedOn, note, taskIds } = input

  await ensureProjectAccess(user, projectId)

  const hoursValue = hours.toString()
  const noteValue = note && note.trim().length ? note.trim() : null

  const timeLogId = await db.transaction(async tx => {
    await assertLinkedTasksEligible(tx, projectId, taskIds)

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

  const project = await getTimeLogProjectContext(projectId)
  const event = timeLogCreatedEvent({
    hours,
    projectName: project.name,
    loggedOn,
    linkedTaskCount: taskIds.length,
    taskIds,
    notePresent: noteValue !== null,
    userId,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    source: options.source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TIME_LOG',
    targetId: timeLogId,
    targetProjectId: projectId,
    targetClientId: project.clientId,
    metadata: event.metadata,
  })

  return timeLogId
}

export async function softDeleteTimeLog(
  user: AppUser,
  projectId: string,
  timeLogId: string,
  options: TimeLogMutationOptions = {},
): Promise<{ loggedOn: string }> {
  const rows = await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
      userId: timeLogs.userId,
      hours: timeLogs.hours,
      loggedOn: timeLogs.loggedOn,
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

  await ensureProjectAccess(user, projectId)

  if (timeLog.deletedAt) {
    return { loggedOn: timeLog.loggedOn }
  }

  // updatedAt must move too (PRD 002 F1): the monthly close drift detector
  // finds post-close changes via record timestamps > closed_at.
  const nowIso = new Date().toISOString()
  await db
    .update(timeLogs)
    .set({ deletedAt: nowIso, updatedAt: nowIso })
    .where(eq(timeLogs.id, timeLogId))

  const hours = Number(timeLog.hours)
  const project = await getTimeLogProjectContext(projectId)
  const event = timeLogDeletedEvent({
    hours,
    loggedOn: timeLog.loggedOn,
    projectName: project.name,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    source: options.source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TIME_LOG',
    targetId: timeLogId,
    targetProjectId: projectId,
    targetClientId: project.clientId,
    metadata: event.metadata,
  })

  return { loggedOn: timeLog.loggedOn }
}

export async function updateTimeLog(
  user: AppUser,
  input: UpdateTimeLogInput,
  options: TimeLogMutationOptions = {},
): Promise<{ previousLoggedOn: string }> {
  const { projectId, timeLogId, userId, hours, loggedOn, note, taskIds } = input

  const rows = await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
      userId: timeLogs.userId,
      hours: timeLogs.hours,
      loggedOn: timeLogs.loggedOn,
      note: timeLogs.note,
      deletedAt: timeLogs.deletedAt,
    })
    .from(timeLogs)
    .where(eq(timeLogs.id, timeLogId))
    .limit(1)

  if (!rows.length) {
    throw new NotFoundError('Time log not found')
  }

  const [existing] = rows

  if (existing.projectId !== projectId) {
    throw new NotFoundError('Time log not found for project')
  }

  if (existing.deletedAt) {
    throw new NotFoundError('Time log has been removed')
  }

  await ensureProjectAccess(user, projectId)

  const targetUserId = userId

  const hoursValue = hours.toString()
  const noteValue = note && note.trim().length ? note.trim() : null

  const previousTaskIds = await getLinkedTaskIds(timeLogId)
  const nextTaskIds = [...new Set(taskIds)].sort()

  await db.transaction(async tx => {
    await assertLinkedTasksEligible(tx, projectId, taskIds)

    await tx
      .update(timeLogs)
      .set({
        userId: targetUserId,
        hours: hoursValue,
        loggedOn,
        note: noteValue,
        // PRD 002 F1: drift detection keys on record timestamps > closed_at.
        updatedAt: new Date().toISOString(),
      })
      .where(eq(timeLogs.id, timeLogId))

    await tx.delete(timeLogTasks).where(eq(timeLogTasks.timeLogId, timeLogId))

    if (taskIds.length) {
      const values = taskIds.map(taskId => ({
        timeLogId,
        taskId,
      }))
      await tx.insert(timeLogTasks).values(values)
    }
  })

  await logTimeLogUpdate({
    user,
    source: options.source,
    projectId,
    timeLogId,
    before: {
      userId: existing.userId,
      hours: Number(existing.hours),
      loggedOn: existing.loggedOn,
      note: existing.note ?? null,
      taskIds: previousTaskIds,
    },
    after: {
      userId: targetUserId,
      hours,
      loggedOn,
      note: noteValue,
      taskIds: nextTaskIds,
    },
  })

  // F6: the caller needs the pre-mutation date — a move OUT of a closed month
  // is undetectable once loggedOn is overwritten.
  return { previousLoggedOn: existing.loggedOn }
}

type TimeLogSnapshot = {
  userId: string
  hours: number
  loggedOn: string
  note: string | null
  taskIds: string[]
}

/** Diffs the two snapshots and writes TIME_LOG_UPDATED; a no-op save is silent. */
async function logTimeLogUpdate(args: {
  user: AppUser
  source?: ActivitySourceValue
  projectId: string
  timeLogId: string
  before: TimeLogSnapshot
  after: TimeLogSnapshot
}): Promise<void> {
  const { before, after } = args
  const changedFields: string[] = []
  const previousDetails: Record<string, unknown> = {}
  const nextDetails: Record<string, unknown> = {}

  if (before.userId !== after.userId) {
    changedFields.push('user')
    previousDetails.userId = before.userId
    nextDetails.userId = after.userId
  }

  if (before.hours !== after.hours) {
    changedFields.push('hours')
    previousDetails.hours = before.hours
    nextDetails.hours = after.hours
  }

  if (before.loggedOn !== after.loggedOn) {
    changedFields.push('date')
    previousDetails.loggedOn = before.loggedOn
    nextDetails.loggedOn = after.loggedOn
  }

  if (before.note !== after.note) {
    changedFields.push('note')
    previousDetails.note = before.note
    nextDetails.note = after.note
  }

  if (!sameIdSet(before.taskIds, after.taskIds)) {
    changedFields.push('linked tasks')
    previousDetails.taskIds = before.taskIds
    nextDetails.taskIds = after.taskIds
  }

  if (!changedFields.length) {
    return
  }

  const project = await getTimeLogProjectContext(args.projectId)
  const event = timeLogUpdatedEvent({
    hours: after.hours,
    projectName: project.name,
    changedFields,
    details: { before: previousDetails, after: nextDetails },
  })

  await logActivity({
    actorId: args.user.id,
    actorRole: args.user.role,
    source: args.source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TIME_LOG',
    targetId: args.timeLogId,
    targetProjectId: args.projectId,
    targetClientId: project.clientId,
    metadata: event.metadata,
  })
}

