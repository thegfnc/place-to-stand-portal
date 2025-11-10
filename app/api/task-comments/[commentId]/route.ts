import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import {
  softDeleteTaskComment,
  updateTaskComment,
} from '@/lib/queries/task-comments'

const paramsSchema = z.object({
  commentId: z.string().uuid(),
})

const updateBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment body is required')
    .max(10_000, 'Comment body exceeds the maximum length'),
})

type RouteContext = {
  params: Promise<{
    commentId: string
  }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  let payload: z.infer<typeof updateBodySchema>

  try {
    payload = updateBodySchema.parse(await request.json())
  } catch (error) {
    console.error('Invalid update task comment payload', error)
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 })
  }

  try {
    await updateTaskComment(user, {
      commentId: parsedParams.data.commentId,
      body: payload.body,
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to update task comment', error)
    return NextResponse.json(
      { error: 'Unable to update comment.' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    await softDeleteTaskComment(user, parsedParams.data.commentId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to delete task comment', error)
    return NextResponse.json(
      { error: 'Unable to delete comment.' },
      { status: 500 },
    )
  }
}
