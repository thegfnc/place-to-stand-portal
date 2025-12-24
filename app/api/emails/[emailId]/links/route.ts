import { NextResponse, type NextRequest } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listEmailLinksForEmail } from '@/lib/queries/emails'
import { toResponsePayload, type HttpError } from '@/lib/errors/http'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ emailId: string }> }) {
  const user = await requireUser()
  const { emailId } = await params

  try {
    const links = await listEmailLinksForEmail(user, emailId)
    return NextResponse.json({ ok: true, links })
  } catch (err) {
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}

