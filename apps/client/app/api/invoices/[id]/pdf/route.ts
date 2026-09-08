import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { fetchClientInvoiceForPdf } from '@/lib/data/invoices'
import { generateInvoicePdf } from '@pts/pdf'

export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid()

/**
 * GET /api/invoices/[id]/pdf
 *
 * Renders one of the viewer's own invoices as a PDF. `?download=1` returns it
 * as an attachment; otherwise it is served inline so the browser's built-in
 * viewer opens it.
 *
 * Authorization is `fetchClientInvoiceForPdf`, which scopes to the caller's
 * client memberships and returns null for anything out of scope, deleted, or
 * still a draft. There is no second membership check here to drift out of sync.
 *
 * Note this deliberately does not record a view the way the internal share page
 * does. That path flips SENT to VIEWED and logs an activity event to tell the
 * team the client opened the emailed link; a portal download is a different
 * signal and should not be mistaken for it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await params
  const parsedId = idSchema.safeParse(id)

  // Same 404 as a real miss — a malformed id should not read differently from
  // one belonging to another client.
  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error: 'Invoice not found' },
      { status: 404 }
    )
  }

  const invoice = await fetchClientInvoiceForPdf(user, parsedId.data)

  if (!invoice) {
    return NextResponse.json(
      { ok: false, error: 'Invoice not found' },
      { status: 404 }
    )
  }

  const url = new URL(request.url)
  const isDownload = url.searchParams.get('download') === '1'

  let pdf: Buffer
  try {
    // No shareUrl: the PDF's "View and pay online" footer is for the emailed
    // copy, and is noise for a reader who is already signed into the portal.
    pdf = await generateInvoicePdf(invoice)
  } catch (error) {
    console.error(
      '[invoice-pdf] Failed to generate PDF for invoice',
      invoice.id,
      error
    )
    return NextResponse.json(
      { ok: false, error: 'Failed to generate invoice PDF' },
      { status: 500 }
    )
  }

  const filename = `${invoice.invoice_number ?? 'invoice'}.pdf`

  // Copy into a plain Uint8Array: Buffer's typing does not line up with
  // BodyInit, and a cast here would be hiding that rather than resolving it.
  return new NextResponse(Uint8Array.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${
        isDownload ? 'attachment' : 'inline'
      }; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
