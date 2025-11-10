import { and, desc, eq, isNull } from 'drizzle-orm'

import { getRankAfter } from '@/lib/rank'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { TASK_STATUSES } from './shared-schemas'

type TaskStatus = (typeof TASK_STATUSES)[number]

export async function resolveNextTaskRank(
  projectId: string,
  status: TaskStatus
) {
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
    .orderBy(desc(tasks.rank))
    .limit(1)

  const rank = rows[0]?.rank ?? null

  return getRankAfter(rank)
}
