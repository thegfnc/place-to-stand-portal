import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

export const taskCreatedEvent = (args: {
  title: string
  status?: string
  dueOn?: string | null
  assigneeIds?: string[]
}): ActivityEvent => {
  const summary = `Created task "${args.title}"`
  const metadata = toMetadata({
    task: {
      title: args.title,
      status: args.status ?? null,
      dueOn: args.dueOn ?? null,
    },
    assignees: {
      added: args.assigneeIds ?? [],
    },
  })

  return {
    verb: ActivityVerbs.TASK_CREATED,
    summary,
    metadata,
  }
}

export const taskUpdatedEvent = (args: {
  title: string
  changedFields: string[]
  details?: Record<string, unknown>
  assigneeChanges?: { added: string[]; removed: string[] }
}): ActivityEvent => {
  const fields = args.changedFields
  const fieldSummary = fields.length ? ` (${joinWithCommas(fields)})` : ''

  return {
    verb: ActivityVerbs.TASK_UPDATED,
    summary: `Updated task "${args.title}"${fieldSummary}`,
    metadata: toMetadata({
      changedFields: fields,
      details: args.details ?? undefined,
      assignees: args.assigneeChanges ?? undefined,
    }),
  }
}

export const taskStatusChangedEvent = (args: {
  title: string
  fromStatus: string
  toStatus: string
}): ActivityEvent => ({
  verb: ActivityVerbs.TASK_STATUS_CHANGED,
  summary: `Moved task "${args.title}" from ${args.fromStatus} to ${args.toStatus}`,
  metadata: toMetadata({
    status: {
      from: args.fromStatus,
      to: args.toStatus,
    },
  }),
})

export const taskArchivedEvent = (args: { title: string }): ActivityEvent => ({
  verb: ActivityVerbs.TASK_ARCHIVED,
  summary: `Archived task "${args.title}"`,
})

export const taskCommentCreatedEvent = (
  args: {
    taskTitle?: string | null
  } = {}
): ActivityEvent => ({
  verb: ActivityVerbs.TASK_COMMENT_CREATED,
  summary: args.taskTitle
    ? `Added a comment to "${args.taskTitle}"`
    : 'Added a comment',
})

export const taskCommentUpdatedEvent = (
  args: {
    taskTitle?: string | null
  } = {}
): ActivityEvent => ({
  verb: ActivityVerbs.TASK_COMMENT_UPDATED,
  summary: args.taskTitle
    ? `Edited a comment on "${args.taskTitle}"`
    : 'Edited a comment',
})

export const taskCommentDeletedEvent = (
  args: {
    taskTitle?: string | null
  } = {}
): ActivityEvent => ({
  verb: ActivityVerbs.TASK_COMMENT_DELETED,
  summary: args.taskTitle
    ? `Removed a comment from "${args.taskTitle}"`
    : 'Removed a comment',
})
