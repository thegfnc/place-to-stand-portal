import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { formatHours, joinWithCommas, toMetadata } from './shared'

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

export const hourBlockRestoredEvent = (args: {
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.HOUR_BLOCK_RESTORED,
  summary: args.clientName
    ? `Restored hour block for ${args.clientName}`
    : 'Restored hour block',
})

export const hourBlockDeletedEvent = (args: {
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.HOUR_BLOCK_DELETED,
  summary: args.clientName
    ? `Permanently deleted hour block for ${args.clientName}`
    : 'Permanently deleted hour block',
})
