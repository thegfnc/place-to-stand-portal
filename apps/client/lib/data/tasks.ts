import 'server-only'

import { cache } from 'react'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { tasks } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { fetchProjectDetail } from '@/lib/data/project-detail'

export type ClientTask = {
  id: string
  title: string
  status: string
}

export type ProjectTasks = {
  /** Work queued or underway: ON_DECK, IN_PROGRESS, BLOCKED. */
  current: ClientTask[]
  /** DONE. ARCHIVED is never returned. */
  completed: ClientTask[]
}

/**
 * What "open" means in the portal. Exported so the dashboard's per-project
 * count can't drift from the list the project page actually renders.
 */
export const CURRENT_STATUSES = ['ON_DECK', 'IN_PROGRESS', 'BLOCKED'] as const

const STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  BLOCKED: 1,
  ON_DECK: 2,
}

/**
 * Groups current tasks by status, preserving the board's manual rank order
 * within each group. Stable, so callers must pass rows already ordered by rank.
 *
 * Shared so the dashboard's inline task list and the project page present the
 * same work in the same order.
 */
function sortCurrentTasks<T extends { status: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  )
}

/**
 * Tasks for a project, split into current and completed.
 *
 * SECURITY: gated on fetchProjectDetail, which returns null for any project
 * outside the caller's portal scope. That call is cache()-wrapped, so when the
 * page has already loaded the project this costs nothing extra. Only the task
 * title and status are selected — descriptions are written for the internal
 * board and are deliberately not exposed here.
 */
export const fetchProjectTasks = cache(
  async (user: AppUser, projectId: string): Promise<ProjectTasks> => {
    const project = await fetchProjectDetail(user, projectId)
    if (!project) return { current: [], completed: [] }

    const [currentRows, completedRows] = await Promise.all([
      db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            isNull(tasks.deletedAt),
            inArray(tasks.status, [...CURRENT_STATUSES])
          )
        )
        // rank preserves the board's manual ordering; the status grouping is
        // applied below.
        .orderBy(asc(tasks.rank)),
      db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            isNull(tasks.deletedAt),
            eq(tasks.status, 'DONE')
          )
        )
        .orderBy(desc(tasks.updatedAt)),
    ])

    return { current: sortCurrentTasks(currentRows), completed: completedRows }
  }
)
