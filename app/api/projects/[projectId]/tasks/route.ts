import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { listProjectTaskCollectionsWithRelations } from '@/lib/queries/tasks'

const paramsSchema = z.object({
  projectId: z.string().uuid(),
})

type RouteContext = {
  params: Promise<{
    projectId: string
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
    const tasks = await listProjectTaskCollectionsWithRelations(
      user,
      parsedParams.data.projectId,
    )

    return NextResponse.json(tasks, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load project tasks', error)
    return NextResponse.json(
      { error: 'Unable to load project tasks.' },
      { status: 500 },
    )
  }
}
