import type { AssignedTaskSummary } from '@/lib/data/tasks'
const STATUS_PRIORITY: Record<string, number> = {
  BLOCKED: 0,
  IN_PROGRESS: 1,
  ON_DECK: 2,
  DONE: 3,
  ARCHIVED: 4,
}

export function sortAssignedTasks(
  tasks: AssignedTaskSummary[]
): AssignedTaskSummary[] {
  const copy = [...tasks]
  copy.sort(compareAssignedTasks)
  return copy
}

function compareAssignedTasks(
  a: AssignedTaskSummary,
  b: AssignedTaskSummary
) {
  const orderA = a.sortOrder ?? null
  const orderB = b.sortOrder ?? null

  if (orderA !== null && orderB !== null && orderA !== orderB) {
    return orderA - orderB
  }

  if (orderA !== null && orderB === null) {
    return -1
  }

  if (orderA === null && orderB !== null) {
    return 1
  }

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
