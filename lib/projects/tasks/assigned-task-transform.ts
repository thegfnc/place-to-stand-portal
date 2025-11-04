import type { AssignedTaskSummary } from '@/lib/data/tasks'

import { isActiveAssignedTaskStatus } from './assigned-task-utils'

export type RawAssignedTaskRow = {
  id: string
  title: string
  status: string
  due_on: string | null
  updated_at: string | null
  created_at: string | null
  deleted_at: string | null
  project_id: string
  project: {
    id: string
    name: string
    slug: string | null
    client?: {
      id: string
      name: string
      slug: string | null
    } | null
  } | null
  assignees: Array<{ user_id: string; deleted_at: string | null }> | null
}

export function toAssignedTaskSummary(
  row: RawAssignedTaskRow | null,
  userId: string
): AssignedTaskSummary | null {
  if (!row || row.deleted_at) {
    return null
  }

  const assignees = (row.assignees ?? []).filter(
    assignee => assignee && !assignee.deleted_at
  )

  if (!assignees.some(assignee => assignee.user_id === userId)) {
    return null
  }

  if (!isActiveAssignedTaskStatus(row.status ?? '')) {
    return null
  }

  const projectName = row.project?.name?.trim() || 'Untitled Project'

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    dueOn: row.due_on ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
    project: {
      id: row.project?.id ?? row.project_id,
      name: projectName,
      slug: row.project?.slug ?? null,
    },
    client: row.project?.client
      ? {
          id: row.project.client.id,
          name: row.project.client.name,
          slug: row.project.client.slug ?? null,
        }
      : null,
  }
}
