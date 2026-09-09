import 'server-only'

import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'

import { richTextToPlainText } from '@/components/ui/rich-text-editor/utils'
import { db } from '@/lib/db'
import { projects, taskComments, tasks } from '@/lib/db/schema'

export type ComposerTaskOption = {
  id: string
  title: string
  status: typeof tasks.$inferSelect.status
  projectName: string
}

/**
 * Tasks the composer can anchor an item to: everything open or recently
 * finished on the client's projects. Sorted so recent work is at the top.
 */
export async function fetchComposerTaskOptions(
  clientId: string
): Promise<ComposerTaskOption[]> {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.clientId, clientId),
        isNull(projects.deletedAt),
        isNull(tasks.deletedAt),
        ne(projects.status, 'COMPLETED')
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(200)
}

/**
 * The most recent comment on each task, as plain text. Shown under an item
 * while editing as a reminder of what happened — it is never sent.
 */
export async function fetchLatestCommentHints(
  taskIds: string[]
): Promise<Record<string, string>> {
  if (taskIds.length === 0) return {}

  const rows = await db
    .select({ taskId: taskComments.taskId, body: taskComments.body })
    .from(taskComments)
    .where(
      and(inArray(taskComments.taskId, taskIds), isNull(taskComments.deletedAt))
    )
    .orderBy(desc(taskComments.createdAt))

  const hints: Record<string, string> = {}
  for (const row of rows) {
    if (hints[row.taskId]) continue
    const text = richTextToPlainText(row.body)
    if (text)
      hints[row.taskId] = text.length > 280 ? `${text.slice(0, 277)}…` : text
  }
  return hints
}
