import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { getThreadById, updateThread } from '@/lib/queries/threads'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser()
  const { threadId } = await params

  const thread = await getThreadById(user, threadId)
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, thread })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser()
  assertAdmin(user)

  const { threadId } = await params
  const body = await request.json()

  const thread = await getThreadById(user, threadId)
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const updates: Parameters<typeof updateThread>[1] = {}

  if ('clientId' in body) {
    updates.clientId = body.clientId || null
  }
  if ('projectId' in body) {
    updates.projectId = body.projectId || null
  }
  if ('status' in body) {
    updates.status = body.status
  }

  const updated = await updateThread(threadId, updates)

  return NextResponse.json({ ok: true, thread: updated })
}
