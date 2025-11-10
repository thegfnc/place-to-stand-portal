import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { softDeleteTimeLog } from '@/lib/queries/time-logs'

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
