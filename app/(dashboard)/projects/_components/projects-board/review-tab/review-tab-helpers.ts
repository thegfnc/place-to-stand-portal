import { format, formatDistanceToNow, parseISO } from 'date-fns'

import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../../lib/projects/board/board-selectors'

const FALLBACK_DASH = '—'
const DISPLAY_DATE_FORMAT = 'MMM d, yyyy'

export const formatDueDate = (value: string | null | undefined) => {
  if (!value) {
    return FALLBACK_DASH
  }

  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return format(parsed, DISPLAY_DATE_FORMAT)
  } catch {
    return value
  }
}

export const formatUpdatedAt = (value: string | null | undefined) => {
  if (!value) {
    return FALLBACK_DASH
  }

  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return formatDistanceToNow(parsed, { addSuffix: true })
  } catch {
    return value
  }
}

export const summarizeAssignees = (
  task: TaskWithRelations,
  renderAssignees: RenderAssigneeFn
) => {
  const assignees = renderAssignees(task)
  if (!assignees.length) {
    return 'Unassigned'
  }

  return assignees.map(person => person.name).join(', ')
}
