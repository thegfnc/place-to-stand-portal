import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { softDeleteTimeLog, updateTimeLog } from '@/lib/queries/time-logs'

const updateBodySchema = z.object({
  userId: z.string().uuid(),
  hours: z.number().positive(),
  loggedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'loggedOn must be in YYYY-MM-DD format'),
  note: z
    .union([z.string().trim().max(2000, 'Notes must be 2000 characters or fewer.'), z.null()])
    .transform(value => (value === null || value.length === 0 ? null : value))
    .optional(),
  taskIds: z.array(z.string().uuid()).optional(),
})

type RouteContext = {
  params: Promise<{
    projectId: string
    timeLogId: string
  }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId, timeLogId } = await context.params

  try {
    await softDeleteTimeLog(user, projectId, timeLogId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to delete time log', error)
    return NextResponse.json(
      { error: 'Unable to delete time log.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId, timeLogId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    console.error('Failed to parse request body', error)
    return NextResponse.json(
      { error: 'Invalid request format.', fieldErrors: {} },
      { status: 400 }
    )
  }

  const parsed = updateBodySchema.safeParse(body)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    parsed.error.issues.forEach(issue => {
      const path = issue.path.join('.')
      if (path) {
        const formField =
          path === 'userId'
            ? 'user'
            : path === 'loggedOn'
              ? 'loggedOn'
              : path === 'hours'
                ? 'hours'
                : path === 'note'
                  ? 'note'
                  : null
        if (formField) {
          fieldErrors[formField] = issue.message
        }
      }
    })

    return NextResponse.json(
      { error: 'Invalid request payload.', fieldErrors },
      { status: 400 }
    )
  }

  const payload = parsed.data

  try {
    await updateTimeLog(user, {
      projectId,
      timeLogId,
      userId: payload.userId,
      hours: payload.hours,
      loggedOn: payload.loggedOn,
      note: payload.note ?? null,
      taskIds: payload.taskIds ?? [],
    })

    return NextResponse.json({ timeLogId })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to update time log', error)
    return NextResponse.json(
      { error: 'Unable to update time log.' },
      { status: 500 },
    )
  }
}
