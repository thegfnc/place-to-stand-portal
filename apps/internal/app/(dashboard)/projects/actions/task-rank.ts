import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import { getRankAfter, getRankBefore } from '@/lib/rank'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { TASK_STATUSES } from './shared-schemas'

type TaskStatus = (typeof TASK_STATUSES)[number]

/**
 * Rank for a task entering `status` in `projectId`. Open columns are queues,
 * so a new arrival joins the end. Done is a log read newest-first — the task
 * that just finished is the one people open the column to find — so it goes
 * to the top instead. Drag-and-drop bypasses this and uses the dropped
 * position directly.
 */
export async function resolveNextTaskRank(
  projectId: string,
  status: TaskStatus
) {
  const toTop = status === 'DONE'

  const rows = await db
    .select({ rank: tasks.rank })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, status),
        isNull(tasks.deletedAt)
      )
    )
    .orderBy(toTop ? asc(tasks.rank) : desc(tasks.rank))
    .limit(1)

  const rank = rows[0]?.rank ?? null

  return toTop ? getRankBefore(rank) : getRankAfter(rank)
}
