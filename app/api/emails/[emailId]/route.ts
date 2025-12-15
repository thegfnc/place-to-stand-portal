import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { getEmailWithLinksById } from '@/lib/queries/emails'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const user = await requireUser()
  const { emailId } = await params

  const email = await getEmailWithLinksById(user.id, emailId)

  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  return NextResponse.json(email)
}
