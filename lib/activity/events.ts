import type { Json } from '@/supabase/types/database'

import { ActivityVerbs, type ActivityEvent } from './types'

const HOURS_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const joinWithCommas = (items: string[]): string => {
  if (items.length === 0) {
    return ''
  }

  if (items.length === 1) {
    return items[0]
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

const toMetadata = (
  value?: Record<string, unknown> | null
): Json | undefined => {
  if (!value || Object.keys(value).length === 0) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Json
}

const formatHours = (hours: number): string => HOURS_FORMAT.format(hours)

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

export const timeLogCreatedEvent = (args: {
  hours: number
  projectName?: string | null
  linkedTaskCount: number
}): ActivityEvent => {
  const formattedHours = formatHours(args.hours)
  const summary = args.projectName
    ? `Logged ${formattedHours} hours to ${args.projectName}`
    : `Logged ${formattedHours} hours`

  return {
    verb: ActivityVerbs.TIME_LOG_CREATED,
    summary,
    metadata: toMetadata({
      hours: args.hours,
      linkedTaskCount: args.linkedTaskCount,
    }),
  }
}

export const clientCreatedEvent = (args: {
  name: string
  memberIds: string[]
}): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_CREATED,
  summary: `Created client "${args.name}"`,
  metadata: toMetadata({
    client: {
      name: args.name,
    },
    members: {
      after: args.memberIds,
    },
  }),
})

export const clientUpdatedEvent = (args: {
  name: string
  changedFields: string[]
  memberChanges?: { added: string[]; removed: string[] }
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_UPDATED,
  summary: `Updated client "${args.name}"${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    members: args.memberChanges,
    details: args.details,
  }),
})

export const clientArchivedEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_ARCHIVED,
  summary: `Archived client "${args.name}"`,
})

export const projectCreatedEvent = (args: {
  name: string
  status: string
  contractorIds: string[]
}): ActivityEvent => ({
  verb: ActivityVerbs.PROJECT_CREATED,
  summary: `Created project "${args.name}"`,
  metadata: toMetadata({
    project: {
      status: args.status,
    },
    contractors: {
      after: args.contractorIds,
    },
  }),
})

export const projectUpdatedEvent = (args: {
  name: string
  changedFields: string[]
  contractorChanges?: { added: string[]; removed: string[] }
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.PROJECT_UPDATED,
  summary: `Updated project "${args.name}"${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    contractors: args.contractorChanges,
    details: args.details,
  }),
})

export const projectArchivedEvent = (args: {
  name: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PROJECT_ARCHIVED,
  summary: `Archived project "${args.name}"`,
})

export const hourBlockCreatedEvent = (args: {
  clientName?: string | null
  hoursPurchased: number
  invoiceNumber?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.HOUR_BLOCK_CREATED,
  summary: args.clientName
    ? `Recorded ${formatHours(args.hoursPurchased)} purchased hours for ${args.clientName}`
    : `Recorded ${formatHours(args.hoursPurchased)} purchased hours`,
  metadata: toMetadata({
    hoursPurchased: args.hoursPurchased,
    invoiceNumber: args.invoiceNumber ?? null,
  }),
})

export const hourBlockUpdatedEvent = (args: {
  clientName?: string | null
  changedFields: string[]
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.HOUR_BLOCK_UPDATED,
  summary: args.clientName
    ? `Updated hour block for ${args.clientName}${
        args.changedFields.length
          ? ` (${joinWithCommas(args.changedFields)})`
          : ''
      }`
    : `Updated hour block${
        args.changedFields.length
          ? ` (${joinWithCommas(args.changedFields)})`
          : ''
      }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const hourBlockArchivedEvent = (args: {
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.HOUR_BLOCK_ARCHIVED,
  summary: args.clientName
    ? `Archived hour block for ${args.clientName}`
    : 'Archived hour block',
})

export const userCreatedEvent = (args: {
  fullName: string
  role: string
  email?: string
}): ActivityEvent => ({
  verb: ActivityVerbs.USER_CREATED,
  summary: `Invited ${args.fullName} (${args.role})`,
  metadata: toMetadata({
    role: args.role,
    email: args.email,
  }),
})

export const userUpdatedEvent = (args: {
  fullName: string
  changedFields: string[]
  details?: Record<string, unknown>
  passwordChanged?: boolean
}): ActivityEvent => ({
  verb: ActivityVerbs.USER_UPDATED,
  summary: `Updated user ${args.fullName}${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
    passwordChanged: args.passwordChanged ?? false,
  }),
})

export const userArchivedEvent = (args: {
  fullName: string
  email?: string
  role?: string
}): ActivityEvent => ({
  verb: ActivityVerbs.USER_ARCHIVED,
  summary: `Archived user ${args.fullName}`,
  metadata: toMetadata({
    email: args.email,
    role: args.role,
  }),
})

export const userRestoredEvent = (args: {
  fullName: string
  email?: string
  role?: string
}): ActivityEvent => ({
  verb: ActivityVerbs.USER_RESTORED,
  summary: `Restored user ${args.fullName}`,
  metadata: toMetadata({
    email: args.email,
    role: args.role,
  }),
})
