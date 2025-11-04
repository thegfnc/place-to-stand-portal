import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity/logger'
import { taskStatusChangedEvent } from '@/lib/activity/events'
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

  const supabase = getSupabaseServerClient()
  const taskId = parsedParams.data.taskId

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select(
      `
        id,
        title,
        rank,
        status,
        project_id,
        project:projects (
          client_id
        )
      `
    )
    .eq('id', taskId)
    .maybeSingle()

  if (taskError) {
    console.error('Failed to load task for reorder', taskError)
    return NextResponse.json(
      { error: 'Unable to load task for reorder.' },
      { status: 500 }
    )
  }

  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    rank: parsedPayload.rank,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  const statusChanged =
    parsedPayload.status && parsedPayload.status !== task.status

  if (statusChanged) {
    updates.status = parsedPayload.status
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select('id, rank, status, project_id, updated_at')
    .maybeSingle()

  if (updateError) {
    console.error('Failed to update task rank', updateError)
    return NextResponse.json(
      { error: 'Unable to update task ordering.' },
      { status: 500 }
    )
  }

  if (!updatedTask) {
    return NextResponse.json(
      { error: 'Unable to update task ordering.' },
      { status: 500 }
    )
  }

  if (statusChanged) {
    try {
      const event = taskStatusChangedEvent({
        title: task.title,
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
        targetProjectId: task.project_id,
        targetClientId: task.project?.client_id ?? null,
        metadata: event.metadata,
      })
    } catch (error) {
      console.error('Failed to log task status change during reorder', error)
    }
  }

  await revalidateProjectTaskViews()

  return NextResponse.json({ task: updatedTask })
}
