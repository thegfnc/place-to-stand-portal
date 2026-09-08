/**
 * Invoice PDF, shared by the client portal (download) and the internal portal
 * (template preview). One copy, so the layout cannot drift between readers.
 */

import { jsPDF } from 'jspdf'

import type { InvoiceWithLineItems } from './invoice-types'

const MARGIN = 20
const FONT = 'helvetica'

const formatCurrency = (amount: string | number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(amount))

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export async function generateInvoicePdf(
  invoice: InvoiceWithLineItems,
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN * 2
  let y = MARGIN

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function ensureSpace(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage()
      y = MARGIN
    }
  }

  function addSpacer(mm: number) {
    y += mm
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  doc.setFontSize(10)
  doc.setFont(FONT, 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('Place to Stand', MARGIN, y)

  doc.setFontSize(24)
  doc.setFont(FONT, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('INVOICE', pageWidth - MARGIN, y, { align: 'right' })
  addSpacer(10)

  // Invoice details
  doc.setFontSize(10)
  doc.setFont(FONT, 'normal')
  doc.setTextColor(80, 80, 80)

  if (invoice.invoice_number) {
    doc.text(`Invoice #: ${invoice.invoice_number}`, MARGIN, y)
    addSpacer(5)
  }

  doc.text(`Issued: ${formatDate(invoice.issued_date)}`, MARGIN, y)
  addSpacer(5)
  doc.text(`Due: ${invoice.due_date ? formatDate(invoice.due_date) : 'Upon receipt'}`, MARGIN, y)
  addSpacer(10)

  // ---------------------------------------------------------------------------
  // Bill To
  // ---------------------------------------------------------------------------

  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  addSpacer(6)

  doc.setFontSize(8)
  doc.setFont(FONT, 'bold')
  doc.setTextColor(120, 120, 120)
  doc.text('BILL TO', MARGIN, y)
  addSpacer(5)

  doc.setFontSize(11)
  doc.setFont(FONT, 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(invoice.client?.name ?? 'Client', MARGIN, y)
  addSpacer(10)

  // ---------------------------------------------------------------------------
  // Line Items Table
  // ---------------------------------------------------------------------------

  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  addSpacer(6)

  // Table header
  const colDesc = MARGIN
  const colQty = MARGIN + contentWidth * 0.5
  const colPrice = MARGIN + contentWidth * 0.65
  const colAmount = pageWidth - MARGIN

  doc.setFontSize(8)
  doc.setFont(FONT, 'bold')
  doc.setTextColor(120, 120, 120)
  doc.text('Description', colDesc, y)
  doc.text('Qty', colQty, y, { align: 'right' })
  doc.text('Unit Price', colPrice + 15, y, { align: 'right' })
  doc.text('Amount', colAmount, y, { align: 'right' })
  addSpacer(6)

  doc.setDrawColor(230, 230, 230)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  addSpacer(5)

  // Table rows
  const lineItems = invoice.line_items.filter(li => !li.deleted_at)
  for (const item of lineItems) {
    ensureSpace(8)

    doc.setFontSize(9)
    doc.setFont(FONT, 'normal')
    doc.setTextColor(0, 0, 0)

    const descLines = doc.splitTextToSize(item.description, contentWidth * 0.48)
    doc.text(descLines, colDesc, y)
    doc.text(item.quantity, colQty, y, { align: 'right' })
    doc.text(formatCurrency(item.unit_price), colPrice + 15, y, { align: 'right' })
    doc.text(formatCurrency(item.amount), colAmount, y, { align: 'right' })
    addSpacer(descLines.length > 1 ? descLines.length * 4 + 2 : 6)
  }

  addSpacer(4)
  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  addSpacer(8)

  // ---------------------------------------------------------------------------
  // Totals
  // ---------------------------------------------------------------------------

  const totalsX = MARGIN + contentWidth * 0.6
  const totalsValueX = pageWidth - MARGIN

  doc.setFontSize(9)
  doc.setFont(FONT, 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Subtotal', totalsX, y)
  doc.text(formatCurrency(invoice.subtotal), totalsValueX, y, {
    align: 'right',
  })
  addSpacer(5)

  const taxRate = invoice.tax_rate ? Number(invoice.tax_rate) : 0
  const taxAmount = Number(invoice.tax_amount)

  if (taxAmount > 0) {
    const taxLabel = `Tax (${(taxRate * 100).toFixed(2).replace(/\.?0+$/, '')}%)`
    doc.text(taxLabel, totalsX, y)
    doc.text(formatCurrency(invoice.tax_amount), totalsValueX, y, {
      align: 'right',
    })
    addSpacer(5)
  }

  doc.setDrawColor(230, 230, 230)
  doc.line(totalsX, y, pageWidth - MARGIN, y)
  addSpacer(6)

  doc.setFontSize(12)
  doc.setFont(FONT, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Total', totalsX, y)
  doc.text(formatCurrency(invoice.total), totalsValueX, y, { align: 'right' })
  addSpacer(12)

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  if (invoice.notes) {
    ensureSpace(20)
    doc.setDrawColor(200, 200, 200)
    doc.line(MARGIN, y, pageWidth - MARGIN, y)
    addSpacer(6)

    doc.setFontSize(8)
    doc.setFont(FONT, 'bold')
    doc.setTextColor(120, 120, 120)
    doc.text('NOTES', MARGIN, y)
    addSpacer(5)

    doc.setFontSize(9)
    doc.setFont(FONT, 'normal')
    doc.setTextColor(80, 80, 80)
    const noteLines = doc.splitTextToSize(invoice.notes, contentWidth)
    ensureSpace(noteLines.length * 4)
    doc.text(noteLines, MARGIN, y)
    addSpacer(noteLines.length * 4 + 4)
  }

  // ---------------------------------------------------------------------------
  // Status watermark for PAID/VOID
  // ---------------------------------------------------------------------------

  if (invoice.status === 'PAID') {
    doc.setFontSize(48)
    doc.setFont(FONT, 'bold')
    doc.setTextColor(34, 197, 94)
    doc.text('PAID', pageWidth / 2, 60, {
      align: 'center',
      angle: 30,
    })
  } else if (invoice.status === 'VOID') {
    doc.setFontSize(48)
    doc.setFont(FONT, 'bold')
    doc.setTextColor(239, 68, 68)
    doc.text('VOID', pageWidth / 2, 60, {
      align: 'center',
      angle: 30,
    })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
