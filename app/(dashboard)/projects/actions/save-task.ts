'use server'

import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import {
  ensureClientAccessByProjectId,
  ensureClientAccessByTaskId,
} from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { taskCreatedEvent, taskUpdatedEvent } from '@/lib/activity/events'
import { db } from '@/lib/db'
import {
  projects,
  taskAssignees,
  tasks,
} from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'
import { resolveNextTaskRank } from './task-rank'

import { revalidateProjectTaskViews } from './shared'
import { baseTaskSchema, type BaseTaskInput } from './shared-schemas'
import type { ActionResult } from './action-types'
import { syncAssignees, syncAttachments } from './task-helpers'

export async function saveTask(input: BaseTaskInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = baseTaskSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid task payload submitted.' }
  }

  const {
    id,
    projectId,
    title,
    description,
    status,
    dueOn,
    assigneeIds,
    attachments,
  } = parsed.data

  const normalizedAssigneeIds = Array.from(new Set(assigneeIds))
  const storage = getSupabaseServiceClient()

  await ensureTaskAttachmentBucket(storage)

  if (!id) {
    try {
      await ensureClientAccessByProjectId(user, projectId)
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
          title,
          description,
          status,
          dueOn,
          createdBy: user.id,
          updatedBy: user.id,
          rank: nextRank,
        })
        .returning({ id: tasks.id })

      insertedId = inserted[0]?.id ?? null
    } catch (error) {
      console.error('Failed to create task', error)
      return {
        error:
          error instanceof Error ? error.message : 'Unable to create task.',
      }
    }

    if (!insertedId) {
      return { error: 'Unable to create task.' }
    }

    try {
      await syncAssignees(insertedId, normalizedAssigneeIds)
      await syncAttachments({
        storage,
        taskId: insertedId,
        actorId: user.id,
        actorRole: user.role,
        attachmentsInput: attachments,
      })
    } catch (assigneeError) {
      console.error('Failed to sync task assignees', assigneeError)
      return { error: 'Task saved but assignees could not be updated.' }
    }

    const event = taskCreatedEvent({
      title,
      status,
      dueOn: dueOn ?? null,
      assigneeIds: normalizedAssigneeIds,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'TASK',
      targetId: insertedId,
      targetProjectId: projectId,
      targetClientId: projectContext[0].clientId,
      metadata: event.metadata,
    })
  } else {
    try {
      await ensureClientAccessByTaskId(user, id)
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
        clientId: projects.clientId,
      })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(tasks.id, id))
      .limit(1)

    const existingTask = existingTaskResult[0]

    if (!existingTask) {
      return { error: 'Task not found.' }
    }

    const existingAssignees = await db
      .select({
        userId: taskAssignees.userId,
      })
      .from(taskAssignees)
      .where(
        and(
          eq(taskAssignees.taskId, id),
          isNull(taskAssignees.deletedAt)
        )
      )

    const existingAssigneeIds = existingAssignees.map(
      assignee => assignee.userId
    )

    let nextRank = existingTask.rank

    if (existingTask.status !== status) {
      try {
        nextRank = await resolveNextTaskRank(
          existingTask.projectId,
          status
        )
      } catch (rankError) {
        console.error(
          'Failed to resolve rank for task status update',
          rankError
        )
        return { error: 'Unable to update task ordering.' }
      }
    }

    try {
      await db
        .update(tasks)
        .set({
          title,
          description,
          status,
          dueOn,
          updatedBy: user.id,
          rank: nextRank,
        })
        .where(eq(tasks.id, id))
    } catch (error) {
      console.error('Failed to update task', error)
      return {
        error:
          error instanceof Error ? error.message : 'Unable to update task.',
      }
    }

    try {
      await syncAssignees(id, normalizedAssigneeIds)
      await syncAttachments({
        storage,
        taskId: id,
        actorId: user.id,
        actorRole: user.role,
        attachmentsInput: attachments,
      })
    } catch (assigneeError) {
      console.error('Failed to sync task assignees', assigneeError)
      return { error: 'Task saved but assignees could not be updated.' }
    }

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingTask.title !== title) {
      changedFields.push('title')
      previousDetails.title = existingTask.title
      nextDetails.title = title
    }

    const previousDescription = existingTask.description ?? null
    const nextDescription = description ?? null

    if (previousDescription !== nextDescription) {
      changedFields.push('description')
      previousDetails.description = previousDescription
      nextDetails.description = nextDescription
    }

    if (existingTask.status !== status) {
      changedFields.push('status')
      previousDetails.status = existingTask.status
      nextDetails.status = status
    }

    const previousDueOn = existingTask.dueOn ?? null
    const nextDueOn = dueOn ?? null

    if (previousDueOn !== nextDueOn) {
      changedFields.push('due date')
      previousDetails.dueOn = previousDueOn
      nextDetails.dueOn = nextDueOn
    }

    const addedAssignees = normalizedAssigneeIds.filter(
      assigneeId => !existingAssigneeIds.includes(assigneeId)
    )
    const removedAssignees = existingAssigneeIds.filter(
      assigneeId => !normalizedAssigneeIds.includes(assigneeId)
    )

    const hasAssigneeChanges =
      addedAssignees.length > 0 || removedAssignees.length > 0

    if (hasAssigneeChanges) {
      changedFields.push('assignees')
    }

    const hasDetailChanges =
      Object.keys(previousDetails).length > 0 ||
      Object.keys(nextDetails).length > 0

    if (changedFields.length > 0 || hasAssigneeChanges) {
      const event = taskUpdatedEvent({
        title,
        changedFields,
        details: hasDetailChanges
          ? {
              before: previousDetails,
              after: nextDetails,
            }
          : undefined,
        assigneeChanges: hasAssigneeChanges
          ? { added: addedAssignees, removed: removedAssignees }
          : undefined,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'TASK',
        targetId: id,
        targetProjectId: existingTask.projectId,
        targetClientId: existingTask.clientId ?? null,
        metadata: event.metadata,
      })
    }
  }

  await revalidateProjectTaskViews()

  return {}
}
