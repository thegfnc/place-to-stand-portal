import { NextResponse, type NextRequest } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { createEmailLink } from '@/lib/queries/emails'
import { toResponsePayload, type HttpError } from '@/lib/errors/http'

export async function POST(req: NextRequest) {
  const user = await requireUser()

  try {
    const body = (await req.json()) as {
      emailMetadataId: string
      clientId?: string | null
      projectId?: string | null
      notes?: string | null
    }

    console.log('[Email Link] Creating link:', {
      emailMetadataId: body.emailMetadataId,
      clientId: body.clientId,
      userId: user.id,
    })

    const created = await createEmailLink(user, {
      emailMetadataId: body.emailMetadataId,
      clientId: body.clientId ?? null,
      projectId: body.projectId ?? null,
      source: 'MANUAL_LINK',
      confidence: null,
      notes: body.notes ?? null,
    })

    console.log('[Email Link] Created successfully:', created.id)

    return NextResponse.json({ ok: true, link: created })
  } catch (err) {
    console.error('[Email Link] Error:', err)
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}

