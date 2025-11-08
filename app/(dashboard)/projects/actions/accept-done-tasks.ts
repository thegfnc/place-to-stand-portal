'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { tasksAcceptedEvent } from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByProjectId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const schema = z.object({
  projectId: z.string().uuid(),
})

export type AcceptDoneTasksResult = ActionResult & {
  acceptedCount: number
}

export async function acceptDoneTasks(input: {
  projectId: string
}): Promise<AcceptDoneTasksResult> {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    return { error: 'Only administrators can accept tasks.', acceptedCount: 0 }
  }

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid acceptance payload.', acceptedCount: 0 }
  }

  const { projectId } = parsed.data

  try {
    await ensureClientAccessByProjectId(user, projectId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Project not found.', acceptedCount: 0 }
    }

    if (error instanceof ForbiddenError) {
      return {
        error: 'You do not have permission to accept these tasks.',
        acceptedCount: 0,
      }
    }

    console.error('Failed to authorize project for bulk acceptance', error)
    return { error: 'Unable to load project details.', acceptedCount: 0 }
  }

  const projectRecords = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  const project = projectRecords[0]

  if (!project) {
    return { error: 'Project not found.', acceptedCount: 0 }
  }

  const tasksToAccept = await db
    .select({
      id: tasks.id,
      title: tasks.title,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, 'DONE'),
        isNull(tasks.deletedAt),
        isNull(tasks.acceptedAt)
      )
    )

  if (tasksToAccept.length === 0) {
    return { acceptedCount: 0 }
  }

  const timestamp = new Date().toISOString()

  await db
    .update(tasks)
    .set({ acceptedAt: timestamp })
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, 'DONE'),
        isNull(tasks.deletedAt),
        isNull(tasks.acceptedAt)
      )
    )

  const event = tasksAcceptedEvent({
    count: tasksToAccept.length,
    projectName: project.name,
    taskIds: tasksToAccept.map(task => task.id),
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROJECT',
    targetId: project.id,
    targetProjectId: project.id,
    targetClientId: project.clientId,
    metadata: event.metadata,
  })

  await revalidateProjectTaskViews()

  return { acceptedCount: tasksToAccept.length }
}
