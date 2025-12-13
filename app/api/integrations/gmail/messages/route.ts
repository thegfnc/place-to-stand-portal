import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { listMessages } from '@/lib/gmail/client'

export async function GET(request: Request) {
  const user = await requireUser()
  const { searchParams } = new URL(request.url)
  const maxResults = searchParams.get('maxResults')
  const pageToken = searchParams.get('pageToken')
  const q = searchParams.get('q')

  try {
    const resp = await listMessages(user.id, {
      maxResults: maxResults ? Number(maxResults) : 10,
      pageToken: pageToken || undefined,
      q: q || undefined,
    })
    return NextResponse.json(resp)
  } catch (err) {
    console.error('Gmail list error', err)
    return NextResponse.json({ error: 'Failed to list messages' }, { status: 500 })
  }
}

