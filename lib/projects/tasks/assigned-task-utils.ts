import type { AssignedTaskSummary } from '@/lib/data/tasks'

const ACTIVE_STATUSES = new Set([
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
])

const STATUS_PRIORITY: Record<string, number> = {
  BLOCKED: 0,
  IN_PROGRESS: 1,
  IN_REVIEW: 2,
  ON_DECK: 3,
  BACKLOG: 4,
  DONE: 5,
  ARCHIVED: 6,
}

export function isActiveAssignedTaskStatus(status: string | null): boolean {
  if (!status) {
    return false
  }

  return ACTIVE_STATUSES.has(status)
}

export function sortAssignedTasks(
  tasks: AssignedTaskSummary[]
): AssignedTaskSummary[] {
  const copy = [...tasks]
  copy.sort(compareAssignedTasks)
  return copy
}

function compareAssignedTasks(a: AssignedTaskSummary, b: AssignedTaskSummary) {
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
