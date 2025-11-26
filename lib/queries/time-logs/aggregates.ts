import 'server-only'

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { timeLogs } from '@/lib/db/schema'
import type { TimeLogSummary } from '@/lib/data/projects/types'

type ProjectTimeLogAggregateRow = {
  projectId: string
  totalHours: string | null
  monthToDateHours: string | null
  lastLogAt: string | null
}

type SumOfHoursRow = {
  totalHours: string | null
}

export async function getSumOfHoursForProject(
  projectId: string,
): Promise<number> {
  const [row] = await db
    .select({
      totalHours: sql<string | null>`COALESCE(SUM(${timeLogs.hours}), '0')`,
    })
    .from(timeLogs)
    .where(and(eq(timeLogs.projectId, projectId), isNull(timeLogs.deletedAt)))
    .limit(1) as SumOfHoursRow[]

  const total = row?.totalHours ?? '0'
  const parsed = Number(total)

  return Number.isFinite(parsed) ? parsed : 0
}

export async function getTimeLogSummariesForProjects(
  projectIds: readonly string[],
): Promise<Map<string, TimeLogSummary>> {
  if (!projectIds.length) {
    return new Map()
  }

  const startOfCurrentMonth = sql`DATE_TRUNC('month', timezone('utc', now()))::date`

  const rows = (await db
    .select({
      projectId: timeLogs.projectId,
      totalHours: sql<string | null>`SUM(${timeLogs.hours})`,
      monthToDateHours: sql<string | null>`
        SUM(
          CASE
            WHEN ${timeLogs.loggedOn} >= ${startOfCurrentMonth}
            THEN ${timeLogs.hours}
            ELSE 0
          END
        )
      `,
      lastLogAt: sql<string | null>`MAX(${timeLogs.loggedOn})`,
    })
    .from(timeLogs)
    .where(
      and(inArray(timeLogs.projectId, projectIds), isNull(timeLogs.deletedAt)),
    )
    .groupBy(timeLogs.projectId)) as ProjectTimeLogAggregateRow[]

  const summaries = new Map<string, TimeLogSummary>()

  rows.forEach(row => {
    const total = Number(row.totalHours ?? '0')
    const monthToDate = Number(row.monthToDateHours ?? '0')
    summaries.set(row.projectId, {
      totalHours: Number.isFinite(total) ? total : 0,
      monthToDateHours: Number.isFinite(monthToDate) ? monthToDate : 0,
      lastLogAt: row.lastLogAt ?? null,
    })
  })

  return summaries
}

