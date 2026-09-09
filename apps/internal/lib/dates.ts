/**
 * Timezone-stable date formatting.
 *
 * Server components render in UTC on Vercel while browsers hydrate in the
 * user's local timezone, so any ambient-timezone formatting produces
 * hydration text mismatches (React #418) plus off-by-one calendar dates for
 * date-only columns. These helpers render identical strings in every runtime:
 * date-only strings ("2026-08-05") are formatted without timezone conversion,
 * and timestamps are pinned to the company timezone.
 */

export const COMPANY_TIME_ZONE = 'America/Los_Angeles'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

type CalendarDateStyle = Pick<
  Intl.DateTimeFormatOptions,
  'year' | 'month' | 'day' | 'weekday' | 'hour' | 'minute'
>

const DEFAULT_STYLE: CalendarDateStyle = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

const getFormatter = (style: CalendarDateStyle, timeZone: string) => {
  const key = `${timeZone}|${JSON.stringify(style)}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { ...style, timeZone })
    formatterCache.set(key, formatter)
  }
  return formatter
}

/**
 * Format a date column value or timestamp into a calendar-date string that is
 * identical on the server and in every client timezone.
 *
 * Date-only strings are formatted via UTC so the stored calendar date is read
 * back verbatim; timestamps are formatted in {@link COMPANY_TIME_ZONE}.
 */
export function formatCalendarDate(
  value: string | Date | null | undefined,
  style: CalendarDateStyle = DEFAULT_STYLE
): string | null {
  if (!value) return null
  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return getFormatter(style, 'UTC').format(new Date(Date.UTC(year, month - 1, day)))
  }
  const parsed = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(parsed.getTime())) return null
  return getFormatter(style, COMPANY_TIME_ZONE).format(parsed)
}
