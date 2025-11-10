import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import {
  createTaskComment,
  listTaskComments,
} from '@/lib/queries/task-comments'

const paramsSchema = z.object({
  taskId: z.string().uuid(),
})

const createBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment body is required')
    .max(10_000, 'Comment body exceeds the maximum length'),
})

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const cursor = searchParams.get('cursor')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

  try {
    const result = await listTaskComments(user, parsedParams.data.taskId, {
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to list task comments', error)
    return NextResponse.json({ error: 'Unable to load comments.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  let payload: z.infer<typeof createBodySchema>

  try {
    payload = createBodySchema.parse(await request.json())
  } catch (error) {
    console.error('Invalid create task comment payload', error)
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 })
  }

  try {
    const { commentId } = await createTaskComment(user, {
      taskId: parsedParams.data.taskId,
      body: payload.body,
    })

    return NextResponse.json({ commentId }, { status: 201 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to create task comment', error)
    return NextResponse.json({ error: 'Unable to add comment.' }, { status: 500 })
  }
}
