import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import {
  createTimeLog,
  listProjectTimeLogs,
} from '@/lib/queries/time-logs'

const listQuerySchema = z.object({
  limit: z
    .string()
    .transform(value => Number.parseInt(value, 10))
    .refine(value => Number.isFinite(value) && value > 0, {
      message: 'limit must be a positive integer',
    })
    .optional(),
})

const createBodySchema = z.object({
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
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = await context.params
  const url = new URL(request.url)
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters.' },
      { status: 400 },
    )
  }

  try {
    const result = await listProjectTimeLogs(
      user,
      projectId,
      parsed.data.limit,
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to list project time logs', error)
    return NextResponse.json(
      { error: 'Unable to load time logs.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = await context.params

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

  const parsed = createBodySchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}

    parsed.error.issues.forEach(issue => {
      const path = issue.path.join('.')
      if (path) {
        // Map Zod field names to form field names
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
      {
        error: 'Invalid request payload.',
        fieldErrors,
      },
      { status: 400 }
    )
  }

  const payload = parsed.data

  try {
    const timeLogId = await createTimeLog(user, {
      projectId,
      userId: payload.userId,
      hours: payload.hours,
      loggedOn: payload.loggedOn,
      note: payload.note ?? null,
      taskIds: payload.taskIds ?? [],
    })

    return NextResponse.json({ timeLogId }, { status: 201 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to create time log', error)
    return NextResponse.json(
      { error: 'Unable to create time log.' },
      { status: 500 },
    )
  }
}
