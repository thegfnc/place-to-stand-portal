import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { syncGmailForUser } from '@/lib/email/sync'

export async function POST() {
  const user = await requireUser()

  try {
    const result = await syncGmailForUser(user.id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
