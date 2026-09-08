import 'server-only'

import { generateInvoicePdf } from '@pts/pdf'

import { buildSampleInvoice } from '@/lib/pdf/sample-invoice'

type PdfTemplateVariant = {
  /** Stable key used in the preview URL. */
  key: string
  label: string
  description: string
}

export type PdfTemplateEntry = {
  id: string
  name: string
  /** One line for the list: page size and renderer. */
  summary: string
  /** Who reads it, as short chips: "Client", "Internal". */
  audiences: string[]
  description: string
  usedBy: string[]
  /** What the renderer reads, so it is clear which fields shape the output. */
  inputs: { label: string; detail: string }[]
  source: string
  variants: PdfTemplateVariant[]
}

const INVOICE_VARIANTS: PdfTemplateVariant[] = [
  {
    key: 'sent',
    label: 'Sent',
    description: 'An open invoice, as downloaded from the client portal.',
  },
  {
    key: 'paid',
    label: 'Paid',
    description:
      'The same invoice after payment: the generator stamps a PAID watermark across the header.',
  },
]

export function buildPdfTemplateCatalog(): PdfTemplateEntry[] {
  return [
    {
      id: 'invoice',
      name: 'Invoice',
      summary: 'A4 · jsPDF via @pts/pdf',
      audiences: ['Client'],
      description:
        'The invoice document a client downloads from the portal. One renderer in @pts/pdf, so the internal and client apps cannot drift.',
      usedBy: [
        'Client portal · GET /api/invoices/[id]/pdf (view and download)',
      ],
      inputs: [
        {
          label: 'Invoice header',
          detail:
            'invoice_number, issued_date, due_date (blank means due on receipt)',
        },
        {
          label: 'Client',
          detail: 'client.name',
        },
        {
          label: 'Line items',
          detail:
            'description, quantity, unit_price, amount for each non-deleted line item, in sort_order',
        },
        {
          label: 'Totals',
          detail: 'subtotal, tax_rate, tax_amount, total',
        },
        {
          label: 'Notes',
          detail: 'notes, printed under the totals when present',
        },
        {
          label: 'Status',
          detail:
            'PAID and VOID add a diagonal watermark; other statuses render plain',
        },
      ],
      source: 'packages/pdf/src/invoice-pdf.ts',
      variants: INVOICE_VARIANTS,
    },
  ]
}

/**
 * Renders a template's sample PDF. Returns null for an unknown id or variant so
 * the route can 404 rather than guess.
 */
export async function renderSamplePdf(
  id: string,
  variantKey: string
): Promise<Buffer | null> {
  if (id !== 'invoice') return null
  if (!INVOICE_VARIANTS.some(variant => variant.key === variantKey)) return null

  const invoice = buildSampleInvoice(
    variantKey === 'paid'
      ? { status: 'PAID', paid_at: '2026-09-03T18:20:00.000Z' }
      : {}
  )

  return generateInvoicePdf(invoice)
}
