import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { resolveNextTaskRank } from '@/app/(dashboard)/projects/actions/task-rank'
import {
  syncAssignees,
  syncAttachments,
} from '@/app/(dashboard)/projects/actions/task-helpers'
import { taskCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { ensureProjectAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { resolveCompletedAt } from '@/lib/projects/task-status'

import type { SaveTaskResult, TaskWriteContext } from './types'

export async function createTaskForActor({
  actor,
  storage,
  input,
  assigneeIds,
  source,
}: TaskWriteContext): Promise<SaveTaskResult> {
  const { projectId, leadId, title, description, status, dueOn, attachments } =
    input

  try {
    await ensureProjectAccess(actor, projectId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Selected project is unavailable.' }
    }
    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to update this project.' }
    }
    console.error('Failed to authorize project access', error)
    return { error: 'Unable to resolve project for new task.' }
  }

  const projectContext = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!projectContext.length) {
    return { error: 'Selected project is unavailable.' }
  }

  let nextRank: string

  try {
    nextRank = await resolveNextTaskRank(projectId, status)
  } catch (rankError) {
    console.error('Failed to resolve rank for new task', rankError)
    return { error: 'Unable to determine ordering for new task.' }
  }

  let insertedId: string | null = null

  try {
    const inserted = await db
      .insert(tasks)
      .values({
        projectId,
        leadId: leadId ?? null,
        title,
        description,
        status,
        dueOn,
        createdBy: actor.id,
        updatedBy: actor.id,
        rank: nextRank,
        // A task can be created straight into DONE (e.g. logging work that
        // was already finished) — stamp it at birth rather than leaving a
        // null that the two-week window would silently drop.
        ...resolveCompletedAt(status, null),
      })
      .returning({ id: tasks.id })

    insertedId = inserted[0]?.id ?? null
  } catch (error) {
    console.error('Failed to create task', error)
    return {
      error: error instanceof Error ? error.message : 'Unable to create task.',
    }
  }

  if (!insertedId) {
    return { error: 'Unable to create task.' }
  }

  // Partial-failure contract: the row exists past this point, so any error
  // must return `taskId` alongside it — a bare error would invite a client
  // retry that duplicates the task.
  try {
    await syncAssignees(insertedId, assigneeIds)
    await syncAttachments({
      storage,
      taskId: insertedId,
      actorId: actor.id,
      actorRole: actor.role,
      attachmentsInput: attachments,
      activity: {
        taskTitle: title,
        projectId,
        clientId: projectContext[0].clientId ?? null,
        source,
      },
    })
  } catch (assigneeError) {
    console.error('Failed to sync task assignees', assigneeError)
    return {
      taskId: insertedId,
      error: 'Task saved but assignees could not be updated.',
    }
  }

  try {
    const event = taskCreatedEvent({
      title,
      status,
      dueOn: dueOn ?? null,
      assigneeIds,
    })

    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      source,
      verb: event.verb,
      summary: event.summary,
      targetType: 'TASK',
      targetId: insertedId,
      targetProjectId: projectId,
      targetClientId: projectContext[0].clientId,
      metadata: event.metadata,
    })
  } catch (activityError) {
    console.error('Failed to log task creation activity', activityError)
    return {
      taskId: insertedId,
      error: 'Task saved but activity could not be recorded.',
    }
  }

  return { taskId: insertedId }
}
