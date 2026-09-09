import 'server-only'

import { and, asc, between, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { COMPANY_TIME_ZONE } from '@/lib/dates'
import { fetchProjectsForClient } from '@/lib/data/clients'
import { db } from '@/lib/db'
import { tasks, timeLogs, timeLogTasks } from '@/lib/db/schema'

import type { ClientUpdateItem } from './types'
import type { UpdateWindow } from './window'

type TaskRow = { id: string; title: string }

/**
 * A scaffold for when no one has written the update yet: one empty item per
 * task that moved this window — completed, blocked, or worked on — labelled
 * with the task title. The body is deliberately blank; the task board knows
 * *which* tasks changed, not what to tell the client about them.
 */
export async function scaffoldItems(
  user: AppUser,
  clientId: string,
  window: UpdateWindow
): Promise<ClientUpdateItem[]> {
  const projects = await fetchProjectsForClient(user, clientId)
  const projectIds = projects.map(project => project.id)
  if (projectIds.length === 0) return []

  const [completed, blocked, workedOn] = await Promise.all([
    fetchCompletedTasks(projectIds, window),
    fetchBlockedTasks(projectIds),
    fetchWorkedOnTasks(projectIds, window),
  ])

  const seen = new Set<string>()
  const items: ClientUpdateItem[] = []
  for (const task of [...completed, ...blocked, ...workedOn]) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    items.push({
      id: crypto.randomUUID(),
      taskId: task.id,
      label: task.title,
      body: '',
    })
  }
  return items
}

const taskColumns = { id: tasks.id, title: tasks.title }

async function fetchCompletedTasks(
  projectIds: string[],
  window: UpdateWindow
): Promise<TaskRow[]> {
  // completed_at is a timestamp; compare on its company-local calendar date so
  // the window edges line up with how dates are shown everywhere else.
  const completedOn = sql`(${tasks.completedAt} AT TIME ZONE ${COMPANY_TIME_ZONE})::date`

  return db
    .select(taskColumns)
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, projectIds),
        isNull(tasks.deletedAt),
        between(completedOn, window.periodStart, window.periodEnd)
      )
    )
    .orderBy(asc(tasks.completedAt))
}

async function fetchBlockedTasks(projectIds: string[]): Promise<TaskRow[]> {
  return db
    .select(taskColumns)
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, projectIds),
        isNull(tasks.deletedAt),
        eq(tasks.status, 'BLOCKED')
      )
    )
    .orderBy(asc(tasks.rank))
}

async function fetchWorkedOnTasks(
  projectIds: string[],
  window: UpdateWindow
): Promise<TaskRow[]> {
  return db
    .selectDistinct(taskColumns)
    .from(timeLogTasks)
    .innerJoin(timeLogs, eq(timeLogTasks.timeLogId, timeLogs.id))
    .innerJoin(tasks, eq(timeLogTasks.taskId, tasks.id))
    .where(
      and(
        inArray(timeLogs.projectId, projectIds),
        isNull(timeLogs.deletedAt),
        isNull(timeLogTasks.deletedAt),
        isNull(tasks.deletedAt),
        between(timeLogs.loggedOn, window.periodStart, window.periodEnd)
      )
    )
    .orderBy(asc(tasks.title))
}
