import { NextResponse } from 'next/server'

import { generateInvoicePdf } from '@pts/pdf'

import { getInvoiceByShareToken } from '@/lib/queries/invoices'

export const dynamic = 'force-dynamic'

const TOKEN_REGEX = /^[a-f0-9]{32}$/

const notFound = () =>
  NextResponse.json({ ok: false, error: 'Invoice not found.' }, { status: 404 })

/**
 * GET /api/public/invoices/[token]/pdf
 *
 * The shared invoice as a PDF — the share page's download button. No session:
 * the share token is the authorization, exactly as for the page itself, so a
 * disabled share or deleted invoice 404s here too. `?download=1` returns an
 * attachment; otherwise the browser's viewer opens it inline.
 *
 * Drafts 404 even though the share page renders them behind a "not finalized"
 * notice: the PDF carries no such notice, and the client portal's download
 * refuses drafts for the same reason.
 *
 * Deliberately records no view — the page load already did, and a download is
 * not a second open.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!TOKEN_REGEX.test(token)) return notFound()

  const invoice = await getInvoiceByShareToken(token)
  if (!invoice || invoice.status === 'DRAFT') return notFound()

  let pdf: Buffer
  try {
    pdf = await generateInvoicePdf(invoice)
  } catch (error) {
    console.error(
      '[api/public/invoices/pdf] Failed to generate PDF for invoice',
      invoice.id,
      error
    )
    return NextResponse.json(
      { ok: false, error: 'Failed to generate invoice PDF.' },
      { status: 500 }
    )
  }

  const isDownload = new URL(request.url).searchParams.get('download') === '1'
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
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
