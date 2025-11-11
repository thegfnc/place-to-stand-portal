import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { listTaskAttachments } from '@/lib/queries/task-attachments'

const paramsSchema = z.object({
  taskId: z.string().uuid(),
})

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const attachments = await listTaskAttachments(
      user,
      parsedParams.data.taskId,
    )

    return NextResponse.json({ attachments }, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load task attachments', error)
    return NextResponse.json(
      { error: 'Unable to load attachments.' },
      { status: 500 },
    )
  }
}

