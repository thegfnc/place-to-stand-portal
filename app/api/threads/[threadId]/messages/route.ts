import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listMessagesForThread } from '@/lib/queries/messages'
import { getThreadById } from '@/lib/queries/threads'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser()
  const { threadId } = await params

  // Verify thread exists and user has access
  const thread = await getThreadById(user, threadId)
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const messages = await listMessagesForThread(threadId, { limit: 100 })

  return NextResponse.json({
    ok: true,
    messages,
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
    },
  })
}
