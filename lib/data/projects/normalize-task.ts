import type { TaskWithRelations } from '@/lib/types'
import type { RawTaskWithRelations } from './types'

export const normalizeRawTask = (
  task: RawTaskWithRelations
): TaskWithRelations => {
  const {
    assignees: rawAssignees,
    comment_count,
    attachment_count,
    attachments,
    ...taskFields
  } = task

  const safeAssignees = (rawAssignees ?? [])
    .filter(assignee => assignee && !assignee.deleted_at)
    .map(assignee => ({ user_id: assignee.user_id }))

  const normalizedCommentCount =
    typeof comment_count === 'number'
      ? comment_count
      : Number(comment_count ?? 0)

  const normalizedAttachments = (attachments ?? []).filter(
    attachment => attachment && !attachment.deleted_at
  )

  const normalizedAttachmentCount =
    typeof attachment_count === 'number'
      ? attachment_count
      : normalizedAttachments.length

  return {
    ...taskFields,
    assignees: safeAssignees,
    commentCount: normalizedCommentCount,
    attachmentCount: normalizedAttachmentCount,
    attachments: attachments ? normalizedAttachments : undefined,
  }
}
