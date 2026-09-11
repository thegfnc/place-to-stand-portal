/**
 * Invoice PDF, shared by the client portal (download) and the internal portal
 * (template preview). One copy, so the layout cannot drift between readers.
 *
 * Lays out the same document as the shared invoice page — logo, number,
 * billed-to / issued, line items, a lime total strip, notes — with PAID and
 * VOID shown as a stamp beside the number rather than a watermark.
 */

import { jsPDF } from 'jspdf'

import {
  capHeight,
  drawLabel,
  drawLogo,
  drawSectionLabel,
  drawStamp,
  drawText,
  setType,
  tracking,
} from './draw'
import type { InvoiceWithLineItems } from './invoice-types'
import { COLORS, FONTS, PX } from './theme'

const MARGIN_X = 64 * PX
const MARGIN_TOP = 64 * PX
const MARGIN_BOTTOM = 48 * PX
/** Dashed rule + footer line, kept clear of content on every page. */
const FOOTER_SPACE = 48 * PX

const formatCurrency = (amount: string | number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(amount))

/** Date-only column ("2026-09-01") → "September 1, 2026". */
const formatDate = (date: string | null): string | null => {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Timestamp (paid_at) → "Sep 3, 2026", pinned to the business's timezone. */
const formatStampDate = (timestamp: string | null): string | null => {
  if (!timestamp) return null
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
}

const formatTaxRate = (rate: number) =>
  (rate * 100).toFixed(2).replace(/\.?0+$/, '')

export async function generateInvoicePdf(
  invoice: InvoiceWithLineItems,
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const right = pageWidth - MARGIN_X
  const contentWidth = right - MARGIN_X
  const contentBottom = pageHeight - MARGIN_BOTTOM - FOOTER_SPACE

  const isPaid = invoice.status === 'PAID'
  const isVoid = invoice.status === 'VOID'
  const invoiceNumber = invoice.invoice_number ?? 'Invoice'

  // Columns, right to left, at the page's widths (amount 112, rate 104, qty 56, 16 gutters).
  const amountRight = right
  const rateRight = amountRight - (112 + 16) * PX
  const qtyRight = rateRight - (104 + 16) * PX
  const descWidth = qtyRight - (56 + 16) * PX - MARGIN_X

  let y = MARGIN_TOP

  /** Starts a new page when `needed` mm won't fit above the footer. */
  function ensureSpace(needed: number, onNewPage?: () => void) {
    if (y + needed <= contentBottom) return
    doc.addPage()
    y = MARGIN_TOP
    onNewPage?.()
  }

  // ---------------------------------------------------------------------------
  // Header: logo, then the invoice number with any status stamp beside it
  // ---------------------------------------------------------------------------

  drawLogo(doc, MARGIN_X, y)
  y += (24 + 56) * PX

  setType(doc, FONTS.label, 11, COLORS.accentInk)
  drawSectionLabel(doc, 'Invoice', MARGIN_X, y + capHeight(doc))
  y += (11 + 14) * PX

  setType(doc, FONTS.head, 64, COLORS.ink)
  const titleBaseline = y + capHeight(doc)
  drawText(doc, invoiceNumber, MARGIN_X, titleBaseline, {
    charSpace: tracking(doc, -0.03),
  })

  if (isPaid || isVoid) {
    drawStamp(doc, {
      tone: isPaid ? 'paid' : 'void',
      detail: isPaid ? formatStampDate(invoice.paid_at) : null,
      right,
      baseline: titleBaseline,
    })
  }
  y = titleBaseline + 40 * PX

  // ---------------------------------------------------------------------------
  // Billed to / Issued
  // ---------------------------------------------------------------------------

  const fields = [
    { label: 'Billed to', value: invoice.client?.name ?? null },
    { label: 'Issued', value: formatDate(invoice.issued_date) },
  ].filter((field): field is { label: string; value: string } =>
    Boolean(field.value),
  )
  const columnGap = 24 * PX
  const columnWidth = (contentWidth - columnGap) / 2

  fields.forEach((field, index) => {
    const x = MARGIN_X + index * (columnWidth + columnGap)
    doc.setLineWidth(1.5 * PX)
    doc.setDrawColor(COLORS.ink)
    doc.line(x, y, x + columnWidth, y)

    setType(doc, FONTS.label, 11, COLORS.muted)
    const labelBaseline = y + 12 * PX + capHeight(doc)
    drawLabel(doc, field.label, x, labelBaseline)

    setType(doc, FONTS.body, 16, COLORS.ink)
    drawText(doc, field.value, x, labelBaseline + 6 * PX + capHeight(doc) + 2 * PX)
  })
  y += (12 + 11 + 6 + 20) * PX

  // ---------------------------------------------------------------------------
  // Line items
  // ---------------------------------------------------------------------------

  function drawTableHeader() {
    setType(doc, FONTS.label, 11, COLORS.muted)
    const baseline = y + capHeight(doc)
    drawLabel(doc, 'Description', MARGIN_X, baseline)
    drawLabel(doc, 'Qty', qtyRight, baseline, { align: 'right' })
    drawLabel(doc, 'Rate', rateRight, baseline, { align: 'right' })
    drawLabel(doc, 'Amount', amountRight, baseline, { align: 'right' })
    y += (11 + 10) * PX
    doc.setLineWidth(1.5 * PX)
    doc.setDrawColor(COLORS.ink)
    doc.line(MARGIN_X, y, right, y)
  }

  y += 48 * PX
  drawTableHeader()

  const lineHeight = 16 * 1.45 * PX
  const lineItems = invoice.line_items.filter(item => !item.deleted_at)

  for (const item of lineItems) {
    setType(doc, FONTS.body, 16, COLORS.ink)
    const lines: string[] = doc.splitTextToSize(item.description, descWidth)
    const rowHeight = 14 * 2 * PX + lines.length * lineHeight
    ensureSpace(rowHeight, drawTableHeader)
    // A page break redraws the header in label type; restore the row's.
    setType(doc, FONTS.body, 16, COLORS.ink)

    const baseline = y + 14 * PX + lineHeight * 0.72
    lines.forEach((line, index) => {
      drawText(doc, line, MARGIN_X, baseline + index * lineHeight)
    })

    setType(doc, FONTS.figure, 15, COLORS.body)
    drawText(doc, String(Number(item.quantity)), qtyRight, baseline, {
      align: 'right',
    })
    drawText(doc, formatCurrency(item.unit_price), rateRight, baseline, {
      align: 'right',
    })
    setType(doc, FONTS.figure, 15, COLORS.ink)
    drawText(doc, formatCurrency(item.amount), amountRight, baseline, {
      align: 'right',
    })

    y += rowHeight
    doc.setLineWidth(1 * PX)
    doc.setDrawColor(COLORS.hairline)
    doc.line(MARGIN_X, y, right, y)
  }

  // ---------------------------------------------------------------------------
  // Totals: subtotal and tax only when there is tax, then the lime strip
  // ---------------------------------------------------------------------------

  const taxRate = invoice.tax_rate ? Number(invoice.tax_rate) : 0
  const hasTax = taxRate > 0
  const totalsWidth = 300 * PX
  const totalsLeft = right - totalsWidth
  const rowStep = (15 * 1.5 + 10) * PX
  const stripHeight = (12 * 2 + 24) * PX

  y += 20 * PX
  ensureSpace((hasTax ? rowStep * 2 : 0) + stripHeight)

  if (hasTax) {
    const rows = [
      { label: 'Subtotal', value: invoice.subtotal },
      { label: `Tax (${formatTaxRate(taxRate)}%)`, value: invoice.tax_amount },
    ]
    for (const row of rows) {
      setType(doc, FONTS.body, 15, COLORS.body)
      const baseline = y + capHeight(doc)
      drawText(doc, row.label, totalsLeft, baseline)
      drawText(doc, formatCurrency(row.value), right, baseline, { align: 'right' })
      y += rowStep
    }
  }

  doc.setFillColor(COLORS.accent)
  doc.rect(totalsLeft, y, totalsWidth, stripHeight, 'F')
  const stripCenter = y + stripHeight / 2

  setType(doc, FONTS.label, 11, COLORS.ink)
  drawLabel(
    doc,
    isPaid ? 'Paid in full' : isVoid ? 'Total' : 'Total due',
    totalsLeft + 14 * PX,
    stripCenter + capHeight(doc) / 2,
    { color: COLORS.ink },
  )
  setType(doc, FONTS.head, 24, COLORS.ink)
  drawText(
    doc,
    formatCurrency(invoice.total),
    right - 14 * PX,
    stripCenter + capHeight(doc) / 2,
    { align: 'right', charSpace: tracking(doc, -0.02) },
  )
  y += stripHeight

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  if (invoice.notes) {
    const noteLineHeight = 16 * 1.55 * PX
    setType(doc, FONTS.body, 16, COLORS.body)
    const noteLines: string[] = doc.splitTextToSize(
      invoice.notes,
      Math.min(560 * PX, contentWidth),
    )

    y += 48 * PX
    ensureSpace((11 + 10) * PX + Math.min(noteLines.length, 3) * noteLineHeight)

    setType(doc, FONTS.label, 11, COLORS.accentInk)
    drawSectionLabel(doc, 'Notes', MARGIN_X, y + capHeight(doc))
    y += (11 + 10) * PX

    for (const line of noteLines) {
      ensureSpace(noteLineHeight)
      setType(doc, FONTS.body, 16, COLORS.body)
      drawText(doc, line, MARGIN_X, y + noteLineHeight * 0.72)
      y += noteLineHeight
    }
  }

  // ---------------------------------------------------------------------------
  // Footer on every page: dashed rule, studio + site, number + page count
  // ---------------------------------------------------------------------------

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    setType(doc, FONTS.label, 11, COLORS.muted)
    const baseline = pageHeight - MARGIN_BOTTOM
    const ruleY = baseline - capHeight(doc) - 14 * PX

    doc.setLineWidth(1 * PX)
    doc.setDrawColor(COLORS.dash)
    doc.setLineDashPattern([4 * PX, 4 * PX], 0)
    doc.line(MARGIN_X, ruleY, right, ruleY)
    doc.setLineDashPattern([], 0)

    drawLabel(doc, 'Place To Stand · placetostandagency.com', MARGIN_X, baseline)
    drawLabel(doc, `${invoiceNumber} · Page ${page} of ${pageCount}`, right, baseline, {
      align: 'right',
    })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
