import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { resolveNextTaskRank } from '@/app/(dashboard)/projects/actions/task-rank'
import {
  syncAssignees,
  syncAttachments,
} from '@/app/(dashboard)/projects/actions/task-helpers'
import { logActivity } from '@/lib/activity/logger'
import { ensureProjectAccess, ensureTaskAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, taskAssignees, tasks } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { resolveCompletedAt } from '@/lib/projects/task-status'

import { buildTaskUpdateEvent } from './save-task-activity'
import type { SaveTaskResult, TaskWriteContext } from './types'

export async function updateTaskForActor(
  taskId: string,
  { actor, storage, input, assigneeIds, source }: TaskWriteContext
): Promise<SaveTaskResult> {
  const { projectId, leadId, title, description, status, dueOn, attachments } =
    input

  try {
    await ensureTaskAccess(actor, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }
    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to update this task.' }
    }
    console.error('Failed to authorize task access', error)
    return { error: 'Unable to update task.' }
  }

  const existingTaskResult = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      rank: tasks.rank,
      dueOn: tasks.dueOn,
      completedAt: tasks.completedAt,
      leadId: tasks.leadId,
      clientId: projects.clientId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const existingTask = existingTaskResult[0]

  if (!existingTask) {
    return { error: 'Task not found.' }
  }

  const projectChanged = existingTask.projectId !== projectId
  let targetClientId = existingTask.clientId ?? null

  // When moving the task to a different project, authorize access to the
  // destination project (mirrors the create path) and resolve its client.
  if (projectChanged) {
    try {
      await ensureProjectAccess(actor, projectId)
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { error: 'Selected project is unavailable.' }
      }
      if (error instanceof ForbiddenError) {
        return { error: 'You do not have permission to use this project.' }
      }
      console.error('Failed to authorize project access', error)
      return { error: 'Unable to resolve project for task.' }
    }

    const newProjectContext = await db
      .select({ clientId: projects.clientId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)

    if (!newProjectContext.length) {
      return { error: 'Selected project is unavailable.' }
    }

    targetClientId = newProjectContext[0].clientId ?? null
  }

  const existingAssignees = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(
      and(eq(taskAssignees.taskId, taskId), isNull(taskAssignees.deletedAt))
    )

  const existingAssigneeIds = existingAssignees.map(assignee => assignee.userId)

  let nextRank = existingTask.rank

  // Recompute ordering when the status changes, or when the task moves to a
  // new project (so it lands correctly in the destination column).
  if (existingTask.status !== status || projectChanged) {
    try {
      nextRank = await resolveNextTaskRank(projectId, status)
    } catch (rankError) {
      console.error('Failed to resolve rank for task status update', rankError)
      return { error: 'Unable to update task ordering.' }
    }
  }

  try {
    await db
      .update(tasks)
      .set({
        projectId,
        // PATCH semantics: an omitted leadId keeps the existing lead link,
        // only an explicit null clears it. `?? null` here once let any save
        // path that didn't know about leads silently sever tasks.lead_id.
        leadId: leadId !== undefined ? leadId : existingTask.leadId,
        title,
        description,
        status,
        dueOn,
        updatedBy: actor.id,
        // There is no on-update trigger for `updated_at`, so an edit that does
        // not set it here leaves the row looking untouched.
        updatedAt: new Date().toISOString(),
        rank: nextRank,
        ...resolveCompletedAt(status, existingTask.completedAt),
      })
      .where(eq(tasks.id, taskId))
  } catch (error) {
    console.error('Failed to update task', error)
    return {
      error: error instanceof Error ? error.message : 'Unable to update task.',
    }
  }

  try {
    await syncAssignees(taskId, assigneeIds)
    await syncAttachments({
      storage,
      taskId,
      actorId: actor.id,
      actorRole: actor.role,
      attachmentsInput: attachments,
      activity: { taskTitle: title, projectId, clientId: targetClientId, source },
    })
  } catch (assigneeError) {
    console.error('Failed to sync task assignees', assigneeError)
    return { error: 'Task saved but assignees could not be updated.' }
  }

  const event = buildTaskUpdateEvent(
    {
      title: existingTask.title,
      description: existingTask.description ?? null,
      status: existingTask.status,
      projectId: existingTask.projectId,
      dueOn: existingTask.dueOn ?? null,
      assigneeIds: existingAssigneeIds,
    },
    {
      title,
      description: description ?? null,
      status,
      projectId,
      dueOn: dueOn ?? null,
      assigneeIds,
    }
  )

  if (event) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      source,
      verb: event.verb,
      summary: event.summary,
      targetType: 'TASK',
      targetId: taskId,
      targetProjectId: projectId,
      targetClientId,
      metadata: event.metadata,
    })
  }

  return { taskId }
}
