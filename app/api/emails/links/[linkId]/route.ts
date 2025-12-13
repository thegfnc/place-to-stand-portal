import { NextResponse, type NextRequest } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { deleteEmailLink } from '@/lib/queries/emails'
import { toResponsePayload, type HttpError } from '@/lib/errors/http'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const user = await requireUser()
  const { linkId } = await params

  try {
    const deleted = await deleteEmailLink(user, linkId)
    return NextResponse.json({ ok: true, deleted })
  } catch (err) {
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}

