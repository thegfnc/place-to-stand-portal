import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { getMessageById } from '@/lib/queries/messages'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const user = await requireUser()
  const { emailId } = await params

  const message = await getMessageById(user, emailId)

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Map to legacy format for backward compatibility
  const email = {
    id: message.id,
    subject: message.subject,
    fromEmail: message.fromEmail,
    fromName: message.fromName,
    bodyText: message.bodyText,
    bodyHtml: message.bodyHtml,
    snippet: message.snippet,
    toEmails: message.toEmails,
    ccEmails: message.ccEmails,
    receivedAt: message.sentAt,
    isRead: message.isRead,
    hasAttachments: message.hasAttachments,
    threadId: message.threadId,
  }

  return NextResponse.json(email)
}
