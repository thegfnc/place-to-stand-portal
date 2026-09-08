import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  projects,
  tasks,
  timeLogs,
} from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'

type UUID = string

function isAdmin(user: AppUser | null | undefined): boolean {
  return !!user && user.role === 'ADMIN'
}

export function assertAdmin(user: AppUser) {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Admin privileges required')
  }
}

/**
 * The internal portal is admin-only (CLIENT users are redirected to the
 * client portal at sign-in), so these guards assert the admin role and then
 * verify the target entity exists and is not soft-deleted.
 */
export async function ensureProjectAccess(user: AppUser, projectId: UUID) {
  assertAdmin(user)

  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project.length) {
    throw new NotFoundError('Project not found')
  }
}

export async function ensureTaskAccess(
  user: AppUser,
  taskId: UUID,
  options: { includeArchived?: boolean } = {}
) {
  const { includeArchived = false } = options

  const whereClause = includeArchived
    ? eq(tasks.id, taskId)
    : and(eq(tasks.id, taskId), isNull(tasks.deletedAt))

  const task = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(whereClause)
    .limit(1)

  if (!task.length) {
    throw new NotFoundError('Task not found')
  }

  await ensureProjectAccess(user, task[0].projectId)
}

export async function ensureTimeLogAccess(user: AppUser, timeLogId: UUID) {
  const timeLog = await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
    })
    .from(timeLogs)
    .where(and(eq(timeLogs.id, timeLogId), isNull(timeLogs.deletedAt)))
    .limit(1)

  if (!timeLog.length) {
    throw new NotFoundError('Time log not found')
  }

  await ensureProjectAccess(user, timeLog[0].projectId)
}
