import 'server-only'

import { cache } from 'react'

import type { UserRole } from '@/lib/auth/session'
import { fetchProjectsWithRelations } from './projects'

export type AssignedTaskSummary = {
  id: string
  title: string
  status: string
  dueOn: string | null
  updatedAt: string | null
  project: {
    id: string
    name: string
    slug: string | null
  }
  client: {
    id: string
    name: string
    slug: string | null
  } | null
}

const DEFAULT_LIMIT = 12

const STATUS_PRIORITY: Record<string, number> = {
  BLOCKED: 0,
  IN_PROGRESS: 1,
  IN_REVIEW: 2,
  ON_DECK: 3,
  BACKLOG: 4,
  DONE: 5,
  ARCHIVED: 6,
}

const ACTIVE_STATUSES = new Set([
  'BACKLOG',
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
])

type FetchAssignedTasksOptions = {
  userId: string
  role: UserRole
  limit?: number
  includeCompletedStatuses?: boolean
}

export const fetchAssignedTasks = cache(
  async ({
    userId,
    role,
    limit = DEFAULT_LIMIT,
    includeCompletedStatuses = false,
  }: FetchAssignedTasksOptions): Promise<AssignedTaskSummary[]> => {
    const projects = await fetchProjectsWithRelations({
      forUserId: userId,
      forRole: role,
    })

    const tasks: AssignedTaskSummary[] = []
    const seenTaskIds = new Set<string>()

    for (const project of projects) {
      const projectSummary: AssignedTaskSummary['project'] = {
        id: project.id,
        name: project.name,
        slug: project.slug ?? null,
      }

      const clientSummary = project.client
        ? {
            id: project.client.id,
            name: project.client.name,
            slug: project.client.slug ?? null,
          }
        : null

      for (const task of project.tasks) {
        if (seenTaskIds.has(task.id)) {
          continue
        }

        const isAssigned = task.assignees.some(
          assignee => assignee.user_id === userId
        )

        if (!isAssigned) {
          continue
        }

        if (
          !includeCompletedStatuses &&
          !ACTIVE_STATUSES.has(task.status ?? '')
        ) {
          continue
        }

        seenTaskIds.add(task.id)
        const updatedAt = task.updated_at ?? task.created_at ?? null
        tasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          dueOn: task.due_on ?? null,
          updatedAt,
          project: projectSummary,
          client: clientSummary,
        })
      }
    }

    tasks.sort(compareTasksByUrgency)

    return tasks.slice(0, Math.max(1, limit))
  }
)

function compareTasksByUrgency(a: AssignedTaskSummary, b: AssignedTaskSummary) {
  const dueA = getDueTimestamp(a.dueOn)
  const dueB = getDueTimestamp(b.dueOn)

  if (dueA !== null && dueB !== null && dueA !== dueB) {
    return dueA - dueB
  }

  if (dueA !== null && dueB === null) {
    return -1
  }

  if (dueA === null && dueB !== null) {
    return 1
  }

  const priorityA = STATUS_PRIORITY[a.status ?? ''] ?? Number.MAX_SAFE_INTEGER
  const priorityB = STATUS_PRIORITY[b.status ?? ''] ?? Number.MAX_SAFE_INTEGER

  if (priorityA !== priorityB) {
    return priorityA - priorityB
  }

  const updatedA = getTimestamp(a.updatedAt)
  const updatedB = getTimestamp(b.updatedAt)

  if (updatedA !== null && updatedB !== null && updatedA !== updatedB) {
    return updatedB - updatedA
  }

  if (updatedA !== null && updatedB === null) {
    return -1
  }

  if (updatedA === null && updatedB !== null) {
    return 1
  }

  return a.title.localeCompare(b.title)
}

function getDueTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function getTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}
