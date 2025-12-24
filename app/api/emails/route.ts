import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { getEmailsWithLinks } from '@/lib/queries/emails'

export async function GET(request: NextRequest) {
  const user = await requireUser()
  const { searchParams } = request.nextUrl

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const emails = await getEmailsWithLinks(user.id, { limit, offset })

  return NextResponse.json({ emails })
}
