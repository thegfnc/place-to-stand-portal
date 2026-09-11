/**
 * The marketing site's blueprint system translated to paper, matching the
 * shared invoice page's white document
 * (`apps/internal/app/(public)/share/invoices/[token]/invoice-document.tsx`).
 *
 * Sizes are written as that page's CSS px and converted here at 96dpi, so a
 * value in one file can be checked against the other at a glance.
 */

/** Millimetres per CSS px at 96dpi. */
export const PX = 25.4 / 96

/** A CSS px font size as jsPDF points. */
export const pt = (px: number) => px * 0.75

export const COLORS = {
  ink: '#0e0f11',
  body: '#3a3b40',
  muted: '#5b5d63',
  hairline: '#e4e4e7',
  dash: '#b9bbc1',
  /** Brand lime — only ever a fill here, with ink on top. */
  accent: '#b5f542',
  /** lime-600, the mark's dot; the frame is the same at 60% over white. */
  mark: '#65a30d',
  markFrame: '#a3c86e',
  /** lime-700, for accent type that has to hold contrast on white. */
  accentInk: '#4d7c0f',
  /** accentInk at 70% over white, for the » terminal on section labels. */
  accentInkSoft: '#82a357',
  voidRule: '#dc2626',
  voidInk: '#b91c1c',
} as const

export type PdfFont = readonly [family: string, style: string]

/**
 * jsPDF ships only the standard PDF fonts, so the page's Space Grotesk
 * (headings), Geist (body) and Geist Mono (labels, figures) all map to
 * Helvetica — whose figures are already tabular. This is the one place to
 * point at embedded TTFs (`doc.addFileToVFS` + `doc.addFont`) if they land.
 */
export const FONTS = {
  head: ['helvetica', 'bold'],
  body: ['helvetica', 'normal'],
  label: ['helvetica', 'normal'],
  figure: ['helvetica', 'normal'],
} as const satisfies Record<string, PdfFont>
