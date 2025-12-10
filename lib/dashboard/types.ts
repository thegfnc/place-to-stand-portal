export type RecentlyViewedSummary = {
  id: string
  name: string
  href: string
  touchedAt: string
  contextLabel?: string | null
}

export type MonthCursor = {
  month: number
  year: number
}

export type HoursSnapshot = {
  month: number
  year: number
  myHours: number
  companyHours: number
  scopeLabel: string
  minCursor: MonthCursor
  maxCursor: MonthCursor
}
