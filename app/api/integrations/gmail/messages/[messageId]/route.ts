import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getMessage, normalizeEmail } from '@/lib/gmail/client'

export async function GET(_request: NextRequest, {
  params,
}: {
  params: Promise<{ messageId: string }>
}) {
  const user = await requireUser()
  const { messageId } = await params
  try {
    const msg = await getMessage(user.id, messageId)
    const normalized = normalizeEmail(msg)
    return NextResponse.json({ message: msg, normalized })
  } catch (err) {
    console.error('Gmail get error', err)
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 })
  }
}
