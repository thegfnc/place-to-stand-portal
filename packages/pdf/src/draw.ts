import type { jsPDF } from 'jspdf'

import { COLORS, FONTS, PX, pt, type PdfFont } from './theme'

const MM_PER_PT = 25.4 / 72
/** Helvetica's cap height as a share of the font size. */
const CAP_RATIO = 0.72

export function setType(
  doc: jsPDF,
  font: PdfFont,
  sizePx: number,
  color: string
) {
  doc.setFont(font[0], font[1])
  doc.setFontSize(pt(sizePx))
  doc.setTextColor(color)
}

/** Cap height of the current font, in mm — for placing a baseline under a top edge. */
export function capHeight(doc: jsPDF): number {
  return doc.getFontSize() * MM_PER_PT * CAP_RATIO
}

/** CSS `letter-spacing` in em, as a jsPDF `charSpace` in mm at the current size. */
export function tracking(doc: jsPDF, em: number): number {
  return em * doc.getFontSize() * MM_PER_PT
}

export function textWidth(doc: jsPDF, text: string, charSpace = 0): number {
  return doc.getTextWidth(text) + charSpace * text.length
}

/**
 * `doc.text` with alignment that accounts for letter spacing — jsPDF's own
 * `align` measures the string without `charSpace`, so tracked right-aligned
 * text would overhang the margin.
 */
export function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  baseline: number,
  {
    align = 'left',
    charSpace = 0,
  }: { align?: 'left' | 'right' | 'center'; charSpace?: number } = {}
) {
  const width = textWidth(doc, text, charSpace)
  const left =
    align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
  doc.text(text, left, baseline, charSpace ? { charSpace } : undefined)
}

/** Uppercase tracked label, as the page's mono field labels. */
export function drawLabel(
  doc: jsPDF,
  text: string,
  x: number,
  baseline: number,
  {
    align = 'left',
    color = COLORS.muted,
  }: { align?: 'left' | 'right'; color?: string } = {}
) {
  setType(doc, FONTS.label, 11, color)
  drawText(doc, text.toUpperCase(), x, baseline, {
    align,
    charSpace: tracking(doc, 0.1),
  })
}

/** The section callout: tiny lime-700 caps with a softer » terminal. */
export function drawSectionLabel(
  doc: jsPDF,
  text: string,
  x: number,
  baseline: number
) {
  setType(doc, FONTS.label, 11, COLORS.accentInk)
  const upper = text.toUpperCase()
  const charSpace = tracking(doc, 0.2)
  drawText(doc, upper, x, baseline, { charSpace })

  const end = x + textWidth(doc, upper, charSpace)
  setType(doc, FONTS.label, 13, COLORS.accentInkSoft)
  doc.text('»', end + 6 * PX - charSpace, baseline)
}

/** Blueprint mark (framed square, lime dot) beside the wordmark. `top` is the mark's top edge. */
export function drawLogo(doc: jsPDF, x: number, top: number) {
  const size = 24 * PX
  const dot = 8 * PX

  doc.setLineWidth(1 * PX)
  doc.setDrawColor(COLORS.markFrame)
  doc.rect(x, top, size, size, 'S')
  doc.setFillColor(COLORS.mark)
  doc.rect(x + (size - dot) / 2, top + (size - dot) / 2, dot, dot, 'F')

  setType(doc, FONTS.head, 20, COLORS.ink)
  drawText(
    doc,
    'Place To Stand',
    x + size + 12 * PX,
    top + size / 2 + capHeight(doc) / 2,
    { charSpace: tracking(doc, -0.025) }
  )
}

/**
 * The PAID / VOID stamp: a ruled box, right-aligned, its bottom edge on
 * `baseline` so it sits level with the invoice number.
 */
export function drawStamp(
  doc: jsPDF,
  {
    tone,
    detail,
    right,
    baseline,
  }: {
    tone: 'paid' | 'void'
    detail: string | null
    right: number
    baseline: number
  }
) {
  const rule = tone === 'paid' ? COLORS.mark : COLORS.voidRule
  const ink = tone === 'paid' ? COLORS.accentInk : COLORS.voidInk
  const label = tone === 'paid' ? 'PAID' : 'VOID'
  const padX = 20 * PX
  const padY = 12 * PX

  setType(doc, FONTS.head, 30, ink)
  const labelSpace = tracking(doc, 0.12)
  const labelWidth = textWidth(doc, label, labelSpace)
  const labelCap = capHeight(doc)

  let detailWidth = 0
  let detailBlock = 0
  let detailSpace = 0
  if (detail) {
    setType(doc, FONTS.label, 11, ink)
    detailSpace = tracking(doc, 0.1)
    detailWidth = textWidth(doc, detail.toUpperCase(), detailSpace)
    detailBlock = 6 * PX + capHeight(doc)
  }

  const width = Math.max(labelWidth, detailWidth) + padX * 2
  const height = padY * 2 + labelCap + detailBlock
  const left = right - width
  const top = baseline - height
  const center = left + width / 2

  doc.setLineWidth(1.5 * PX)
  doc.setDrawColor(rule)
  doc.rect(left, top, width, height, 'S')

  setType(doc, FONTS.head, 30, ink)
  drawText(doc, label, center, top + padY + labelCap, {
    align: 'center',
    charSpace: labelSpace,
  })

  if (detail) {
    setType(doc, FONTS.label, 11, ink)
    drawText(doc, detail.toUpperCase(), center, top + padY + labelCap + detailBlock, {
      align: 'center',
      charSpace: detailSpace,
    })
  }
}
