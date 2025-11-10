import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { taskStatusChangedEvent } from '@/lib/activity/events'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { revalidateProjectTaskViews } from '@/app/(dashboard)/projects/actions/shared'
import { statusSchema } from '@/app/(dashboard)/projects/actions/shared-schemas'

const rankPattern = /^[0-9a-z]+$/

const payloadSchema = z.object({
  rank: z
    .string()
    .min(1)
    .max(255)
    .transform(value => value.trim().toLowerCase())
    .refine(value => rankPattern.test(value), {
      message: 'Rank must contain only digits 0-9 or lowercase letters a-z.',
    }),
  status: statusSchema.optional(),
})

const paramsSchema = z.object({
  taskId: z.string().uuid(),
})

type RouteParams = {
  params: Promise<{
    taskId: string
  }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolvedParams = await params
  const parsedParams = paramsSchema.safeParse(resolvedParams)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid task id.' }, { status: 400 })
  }

  let parsedPayload: z.infer<typeof payloadSchema>

  try {
    const json = await request.json()
    const result = payloadSchema.safeParse(json)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid reorder payload.' },
        { status: 400 }
      )
    }

    parsedPayload = result.data
  } catch (error) {
    console.error('Failed to parse reorder payload', error)
    return NextResponse.json(
      { error: 'Invalid reorder payload.' },
      { status: 400 }
    )
  }

  const taskId = parsedParams.data.taskId

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'You do not have permission to reorder this task.' },
        { status: 403 }
      )
    }

    console.error('Failed to authorize task for reorder', error)
    return NextResponse.json(
      { error: 'Unable to load task for reorder.' },
      { status: 500 }
    )
  }

  const taskRecord = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      rank: tasks.rank,
      status: tasks.status,
      projectId: tasks.projectId,
      clientId: projects.clientId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const task = taskRecord[0]

  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  const statusChanged =
    parsedPayload.status && parsedPayload.status !== task.status

  const updatedAt = new Date().toISOString()

  const updatedTaskRecords = await db
    .update(tasks)
    .set({
      rank: parsedPayload.rank,
      status: statusChanged ? parsedPayload.status! : task.status,
      updatedBy: user.id,
      updatedAt,
    })
    .where(eq(tasks.id, taskId))
    .returning({
      id: tasks.id,
      rank: tasks.rank,
      status: tasks.status,
      projectId: tasks.projectId,
      updatedAt: tasks.updatedAt,
    })

  const updatedTask = updatedTaskRecords[0]

  if (!updatedTask) {
    return NextResponse.json(
      { error: 'Unable to update task ordering.' },
      { status: 500 }
    )
  }

  if (statusChanged) {
    try {
      const event = taskStatusChangedEvent({
        title: task.title ?? 'Task',
        fromStatus: task.status,
        toStatus: parsedPayload.status!,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'TASK',
        targetId: taskId,
        targetProjectId: task.projectId,
        targetClientId: task.clientId ?? null,
        metadata: event.metadata,
      })
    } catch (error) {
      console.error('Failed to log task status change during reorder', error)
    }
  }

  await revalidateProjectTaskViews()

  return NextResponse.json({
    task: {
      id: updatedTask.id,
      rank: updatedTask.rank,
      status: updatedTask.status,
      project_id: updatedTask.projectId,
      updated_at: updatedTask.updatedAt,
    },
  })
}
