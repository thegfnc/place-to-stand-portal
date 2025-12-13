import { NextResponse, type NextRequest } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { matchAndLinkEmail } from '@/lib/email/matcher'
import { toResponsePayload, type HttpError } from '@/lib/errors/http'

export async function POST(req: NextRequest) {
  const user = await requireUser()

  try {
    const body = (await req.json()) as { emailMetadataId: string }
    const result = await matchAndLinkEmail(user, body.emailMetadataId)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}

