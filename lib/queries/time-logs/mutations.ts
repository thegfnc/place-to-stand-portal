import 'server-only'

import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureClientAccessByProjectId,
  isAdmin,
} from '@/lib/auth/permissions'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { db } from '@/lib/db'
import {
  timeLogTasks,
  timeLogs,
} from '@/lib/db/schema'

export type CreateTimeLogInput = {
  projectId: string
  userId: string
  hours: number
  loggedOn: string
  note: string | null
  taskIds: string[]
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

