import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { formatHours, joinWithCommas, toMetadata } from './shared'

export const timeLogCreatedEvent = (args: {
  hours: number
  projectName?: string | null
  loggedOn?: string
  linkedTaskCount: number
  taskIds?: string[]
  notePresent?: boolean
  userId?: string
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
      loggedOn: args.loggedOn,
      linkedTaskCount: args.linkedTaskCount,
      taskIds: args.taskIds,
      notePresent: args.notePresent,
      userId: args.userId,
    }),
  }
}

export const timeLogUpdatedEvent = (args: {
  hours: number
  projectName?: string | null
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
}): ActivityEvent => {
  const formattedHours = formatHours(args.hours)
  const fieldSummary = args.changedFields.length
    ? ` (${joinWithCommas(args.changedFields)})`
    : ''
  const summary = args.projectName
    ? `Updated a ${formattedHours} hour time log on ${args.projectName}${fieldSummary}`
    : `Updated a ${formattedHours} hour time log${fieldSummary}`

  return {
    verb: ActivityVerbs.TIME_LOG_UPDATED,
    summary,
    metadata: toMetadata({
      changedFields: args.changedFields,
      details: args.details,
    }),
  }
}

export const timeLogDeletedEvent = (args: {
  hours: number
  loggedOn: string
  projectName?: string | null
}): ActivityEvent => {
  const formattedHours = formatHours(args.hours)
  const summary = args.projectName
    ? `Deleted a ${formattedHours} hour time log from ${args.projectName}`
    : `Deleted a ${formattedHours} hour time log`

  return {
    verb: ActivityVerbs.TIME_LOG_DELETED,
    summary,
    metadata: toMetadata({
      hours: args.hours,
      loggedOn: args.loggedOn,
    }),
  }
}
