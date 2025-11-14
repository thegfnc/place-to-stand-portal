import 'server-only'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureClientAccessByProjectId,
  ensureClientAccessByTaskId,
  isAdmin,
  listAccessibleTaskIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import { taskFields, type SelectTask } from './common'

export async function listTasksForProject(
  user: AppUser,
  projectId: string,
): Promise<SelectTask[]> {
  await ensureClientAccessByProjectId(user, projectId)

  return db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.rank))
}

export async function listTasksForUser(
  user: AppUser,
): Promise<SelectTask[]> {
  if (isAdmin(user)) {
    return db
      .select(taskFields)
      .from(tasks)
      .where(isNull(tasks.deletedAt))
      .orderBy(asc(tasks.rank))
  }

  const taskIds = await listAccessibleTaskIds(user)

  if (!taskIds.length) {
    return []
  }

  return db
    .select(taskFields)
    .from(tasks)
    .where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.rank))
}

export async function getTaskById(
  user: AppUser,
  taskId: string,
): Promise<SelectTask> {
  await ensureClientAccessByTaskId(user, taskId)

  const result = await db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Task not found')
  }

  return result[0]
}

export type { SelectTask } from './common'

