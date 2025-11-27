export type LeadNotesPayload = { html: string }

export function serializeLeadNotes(
  value: string | null | undefined
): Record<string, unknown> {
  const trimmed = (value ?? '').trim()

  if (!trimmed) {
    return {}
  }

  return { html: trimmed }
}

export function extractLeadNotes(notes: unknown): string {
  if (notes && typeof notes === 'object' && 'html' in notes) {
    const htmlValue = (notes as Record<string, unknown>).html
    if (typeof htmlValue === 'string') {
      return htmlValue
    }
  }

  return ''
}

