export type MonthCursor = {
  month: number
  year: number
}

/**
 * One of my time logs as the hours widget needs it. Deliberately not
 * `TimeLogEntry` from lib/projects/time-log/types: that shape carries a full
 * user record per row, which is pure weight here where every row is the same
 * person.
 */
export type DashboardTimeLogEntry = {
  id: string
  loggedOn: string
  hours: number
  note: string | null
  projectId: string
  projectName: string
  projectSlug: string | null
  projectType: string
  clientName: string | null
  clientSlug: string | null
  taskTitles: string[]
}

export type DashboardTimeLogPage = {
  items: DashboardTimeLogEntry[]
  totalCount: number
}

export const HOURS_WIDGET_LOG_PAGE_SIZE = 5

export type HoursSnapshot = {
  month: number
  year: number
  myHours: number
  companyHours: number
  companyHoursPrepaid: number
  internalPersonalHours: number
  scopeLabel: string
  minCursor: MonthCursor
  maxCursor: MonthCursor
  /** First page of my logs for this month; later pages arrive via the API. */
  timeLogs: DashboardTimeLogPage
}
