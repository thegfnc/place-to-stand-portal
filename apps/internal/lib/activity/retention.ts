import 'server-only'

import { inArray, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'

const BATCH_SIZE = 5000

export const retentionCutoff = (retentionDays: number, now = new Date()) =>
  new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

/**
 * Deletes activity_logs rows created before `cutoff`, in batches so a large
 * backlog never holds one long-running lock. Loops until a batch deletes
 * nothing. activity_logs is append-only (no deleted_at), so this is the only
 * place rows ever leave the table.
 */
export async function pruneActivityLogsBefore(cutoff: Date): Promise<number> {
  let deletedCount = 0

  for (;;) {
    const batch = db
      .select({ id: activityLogs.id })
      .from(activityLogs)
      .where(lt(activityLogs.createdAt, cutoff.toISOString()))
      .limit(BATCH_SIZE)

    const deleted = await db
      .delete(activityLogs)
      .where(inArray(activityLogs.id, batch))
      .returning({ id: activityLogs.id })

    deletedCount += deleted.length

    if (deleted.length < BATCH_SIZE) {
      break
    }
  }

  return deletedCount
}
