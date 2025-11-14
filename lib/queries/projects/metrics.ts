import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { tasks, timeLogs } from '@/lib/db/schema'

export async function countTasksForProject(projectId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))

  return Number(result[0]?.count ?? 0)
}

export async function countTimeLogsForProject(projectId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(timeLogs)
    .where(eq(timeLogs.projectId, projectId))

  return Number(result[0]?.count ?? 0)
}

