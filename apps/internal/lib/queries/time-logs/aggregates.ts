import 'server-only'

import { and, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { timeLogs } from '@/lib/db/schema'
import type { TimeLogSummary } from '@/lib/data/projects/types'

type ProjectTimeLogAggregateRow = {
  projectId: string
  totalHours: string | null
  monthToDateHours: string | null
  lastLogAt: string | null
}

export async function getTimeLogSummariesForProjects(
  projectIds: readonly string[],
): Promise<Map<string, TimeLogSummary>> {
  if (!projectIds.length) {
    return new Map()
  }

  const startOfCurrentMonth = sql`DATE_TRUNC('month', timezone('America/Los_Angeles', now()))::date`

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

