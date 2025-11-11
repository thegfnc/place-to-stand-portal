import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clientMembers,
  clients,
  projects,
  taskAssignees,
  taskComments,
  taskAttachments,
  tasks,
  timeLogTasks,
  timeLogs,
} from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'

type UUID = string

export function isAdmin(user: AppUser | null | undefined): boolean {
  return !!user && user.role === 'ADMIN'
}

export function assertAdmin(user: AppUser) {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Admin privileges required')
  }
}

export function assertIsSelf(user: AppUser, targetUserId: UUID) {
  if (isAdmin(user)) {
    return
  }

  if (user.id !== targetUserId) {
    throw new ForbiddenError('Insufficient permissions to access user')
  }
}

export async function ensureClientAccess(user: AppUser, clientId: UUID) {
  if (isAdmin(user)) {
    return
  }

  const membership = await db
    .select({ id: clientMembers.id })
    .from(clientMembers)
    .where(
      and(
        eq(clientMembers.clientId, clientId),
        eq(clientMembers.userId, user.id),
        isNull(clientMembers.deletedAt)
      )
    )
    .limit(1)

  if (!membership.length) {
    throw new ForbiddenError('Insufficient permissions to access client')
  }
}

export async function ensureClientAccessByProjectId(
  user: AppUser,
  projectId: UUID
) {
  const project = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project.length) {
    throw new NotFoundError('Project not found')
  }

  await ensureClientAccess(user, project[0].clientId)
}

export async function ensureClientAccessByTaskId(
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

  await ensureClientAccessByProjectId(user, task[0].projectId)
}

export async function ensureClientAccessByTaskCommentId(
  user: AppUser,
  taskCommentId: UUID
) {
  const comment = await db
    .select({ id: taskComments.id, taskId: taskComments.taskId })
    .from(taskComments)
    .where(
      and(eq(taskComments.id, taskCommentId), isNull(taskComments.deletedAt))
    )
    .limit(1)

  if (!comment.length) {
    throw new NotFoundError('Task comment not found')
  }

  await ensureClientAccessByTaskId(user, comment[0].taskId)
}

export async function ensureClientAccessByTimeLogId(
  user: AppUser,
  timeLogId: UUID
) {
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

  await ensureClientAccessByProjectId(user, timeLog[0].projectId)
}

export async function ensureClientAccessByTimeLogTaskId(
  user: AppUser,
  timeLogTaskId: UUID
) {
  const timeLogTask = await db
    .select({
      id: timeLogTasks.id,
      timeLogId: timeLogTasks.timeLogId,
    })
    .from(timeLogTasks)
    .where(
      and(eq(timeLogTasks.id, timeLogTaskId), isNull(timeLogTasks.deletedAt))
    )
    .limit(1)

  if (!timeLogTask.length) {
    throw new NotFoundError('Time log task not found')
  }

  await ensureClientAccessByTimeLogId(user, timeLogTask[0].timeLogId)
}

export async function ensureClientAccessByTaskAttachmentId(
  user: AppUser,
  attachmentId: UUID
) {
  const attachment = await db
    .select({
      id: taskAttachments.id,
      taskId: taskAttachments.taskId,
    })
    .from(taskAttachments)
    .where(
      and(
        eq(taskAttachments.id, attachmentId),
        isNull(taskAttachments.deletedAt)
      )
    )
    .limit(1)

  if (!attachment.length) {
    throw new NotFoundError('Task attachment not found')
  }

  await ensureClientAccessByTaskId(user, attachment[0].taskId)
}

export async function listAccessibleClientIds(user: AppUser) {
  if (isAdmin(user)) {
    const rows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(isNull(clients.deletedAt))

    return rows.map(row => row.id)
  }

  const memberships = await db
    .select({ clientId: clientMembers.clientId })
    .from(clientMembers)
    .where(
      and(eq(clientMembers.userId, user.id), isNull(clientMembers.deletedAt))
    )

  if (!memberships.length) {
    return []
  }

  return memberships.map(membership => membership.clientId)
}

export async function listAccessibleProjectIds(user: AppUser) {
  if (isAdmin(user)) {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(isNull(projects.deletedAt))

    return rows.map(row => row.id)
  }

  const clientIds = await listAccessibleClientIds(user)

  if (!clientIds.length) {
    return []
  }

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(inArray(projects.clientId, clientIds), isNull(projects.deletedAt))
    )

  return rows.map(row => row.id)
}

export async function listAccessibleTaskIds(user: AppUser) {
  if (isAdmin(user)) {
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(isNull(tasks.deletedAt))

    return rows.map(row => row.id)
  }

  const projectIds = await listAccessibleProjectIds(user)

  if (!projectIds.length) {
    return []
  }

  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt)))

  return rows.map(row => row.id)
}

export async function ensureTaskAssigneeAccess(
  user: AppUser,
  taskId: UUID,
  assigneeId: UUID
) {
  await ensureClientAccessByTaskId(user, taskId)

  const assignee = await db
    .select({ id: taskAssignees.id })
    .from(taskAssignees)
    .where(
      and(
        eq(taskAssignees.taskId, taskId),
        eq(taskAssignees.userId, assigneeId)
      )
    )
    .limit(1)

  if (!assignee.length) {
    throw new NotFoundError('Task assignee not found')
  }
}
