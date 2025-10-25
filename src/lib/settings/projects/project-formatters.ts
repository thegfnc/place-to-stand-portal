import { format, parseISO } from 'date-fns'

/**
 * Normalizes a date string and formats it for display. Returns null when the
 * input is missing or cannot be parsed.
 */
export function formatProjectDate(value?: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const normalized = value.includes('T') ? value : `${value}T00:00:00`
    // Ensure the stored date renders as the exact day selected, regardless of timezone.
    return format(parseISO(normalized), 'MMM d, yyyy')
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Unable to format project date', { value, error })
    }
    return null
  }
}

/**
 * Produces a human-readable date range for a project, gracefully handling
 * missing bounds and identical start/end days.
 */
export function formatProjectDateRange(
  start?: string | null,
  end?: string | null
): string {
  if (!start && !end) {
    return '—'
  }

  const startLabel = formatProjectDate(start) ?? 'TBD'
  const endLabel = formatProjectDate(end) ?? 'TBD'

  if (startLabel === endLabel) {
    return startLabel
  }

  return `${startLabel} – ${endLabel}`
}
