import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { formatHours, toMetadata } from './shared'

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
