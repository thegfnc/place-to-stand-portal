import type { TaskWithRelations } from '@/lib/types'
import type { RawTaskWithRelations } from './types'

export const normalizeRawTask = (
  task: RawTaskWithRelations
): TaskWithRelations => {
  const { assignees: rawAssignees, comments, attachments, ...taskFields } = task

  const safeAssignees = (rawAssignees ?? [])
    .filter(assignee => assignee && !assignee.deleted_at)
    .map(assignee => ({ user_id: assignee.user_id }))

  const commentCount = (comments ?? []).filter(
    comment => comment && !comment.deleted_at
  ).length

  const safeAttachments = (attachments ?? []).filter(
    attachment => attachment && !attachment.deleted_at
  )

  return {
    ...taskFields,
    assignees: safeAssignees,
    commentCount,
    attachments: safeAttachments,
  }
}
