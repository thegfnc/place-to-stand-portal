import 'server-only'

import { COMPANY_TIME_ZONE } from '@/lib/dates'

import { fetchLastSentPeriodEnd } from './queries'

export type UpdateWindow = {
  periodStart: string
  periodEnd: string
}

const DEFAULT_LOOKBACK_DAYS = 7

/** Today's calendar date in the company timezone as YYYY-MM-DD. */
export function todayCalendarDate(): string {
  // en-CA renders as YYYY-MM-DD, which is exactly the date column format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPANY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function shiftCalendarDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

/**
 * Where the report should start. An explicit `since` wins; otherwise pick up
 * the day after the last sent update so consecutive reports tile without a
 * gap or an overlap; otherwise fall back to a week.
 */
export async function resolveUpdateWindow(
  clientId: string,
  since?: string | null
): Promise<UpdateWindow> {
  const periodEnd = todayCalendarDate()

  if (since) return { periodStart: since, periodEnd }

  const lastPeriodEnd = await fetchLastSentPeriodEnd(clientId)
  if (lastPeriodEnd) {
    return { periodStart: shiftCalendarDate(lastPeriodEnd, 1), periodEnd }
  }

  return {
    periodStart: shiftCalendarDate(periodEnd, -DEFAULT_LOOKBACK_DAYS),
    periodEnd,
  }
}
