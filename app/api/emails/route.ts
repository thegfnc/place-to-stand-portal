import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listMessagesForUser } from '@/lib/queries/messages'

export async function GET(request: NextRequest) {
  const user = await requireUser()
  const { searchParams } = request.nextUrl

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const messages = await listMessagesForUser(user.id, { limit, offset })

  // Map to legacy format for backward compatibility
  const emails = messages.map(m => ({
    id: m.id,
    subject: m.subject,
    fromEmail: m.fromEmail,
    fromName: m.fromName,
    snippet: m.snippet,
    receivedAt: m.sentAt,
    isRead: m.isRead,
    threadId: m.threadId,
  }))

  return NextResponse.json({ emails })
}
