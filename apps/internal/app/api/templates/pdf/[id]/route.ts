import { NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { renderSamplePdf } from '@/lib/pdf/catalog'

/**
 * GET /api/templates/pdf/[id]?variant=<key>
 *
 * Serves a PDF template rendered with placeholder data, inline, for the
 * Settings → Templates preview. Never touches real records.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  assertAdmin(user)

  const { id } = await params
  const variant = new URL(request.url).searchParams.get('variant') ?? ''

  const pdf = await renderSamplePdf(id, variant)

  if (!pdf) {
    return NextResponse.json(
      { ok: false, error: 'Unknown PDF template' },
      { status: 404 }
    )
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${id}-${variant}-sample.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
