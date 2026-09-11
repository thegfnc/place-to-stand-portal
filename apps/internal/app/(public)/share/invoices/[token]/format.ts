export const formatCurrency = (value: string | number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof value === 'string' ? Number(value) : value)

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** `long` → "September 3, 2026"; `short` → "Sep 3, 2026" (the paid stamp). */
export const formatDate = (
  dateStr: string | null,
  style: 'long' | 'short' = 'long'
) => {
  if (!dateStr) return null
  // Date-only strings (e.g. "2026-03-10") parse as UTC midnight, so formatting
  // them in local time shifts the date for viewers west of UTC — and the
  // server-rendered HTML (UTC) would mismatch the client during hydration.
  // Appending T00:00:00 parses them as local midnight on both sides.
  const isDateOnly = DATE_ONLY_RE.test(dateStr)
  const date = new Date(isDateOnly ? `${dateStr}T00:00:00` : dateStr)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: style,
    day: 'numeric',
    // Full timestamps (paid_at) must render in a fixed timezone so the
    // server-rendered HTML matches what every viewer's browser hydrates.
    ...(isDateOnly ? {} : { timeZone: 'America/Los_Angeles' }),
  })
}

export const formatTaxRate = (taxRate: string | null) => {
  if (!taxRate) return '0'
  const rate = Number(taxRate) * 100
  return rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2).replace(/0+$/, '')
}
