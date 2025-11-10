import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { getTaskSummaryForUser } from '@/lib/queries/tasks'

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
    const summary = await getTaskSummaryForUser(user, parsedParams.data.taskId)
    return NextResponse.json(summary, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load task summary', error)
    return NextResponse.json(
      { error: 'Unable to load task summary.' },
      { status: 500 },
    )
  }
}
