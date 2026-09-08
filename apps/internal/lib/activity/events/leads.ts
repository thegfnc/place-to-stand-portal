import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'
export const leadUpdateLoggedEvent = (args: {
  contactName: string
  type: string
  typeLabel: string
  occurredAt: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_UPDATE_LOGGED,
  summary: `Logged ${args.typeLabel.toLowerCase()} on lead "${args.contactName}"`,
  metadata: toMetadata({
    update: {
      type: args.type,
      occurredAt: args.occurredAt,
    },
  }),
})
export const leadConvertedEvent = (args: {
  leadId: string
  leadName: string
  clientId: string
  clientName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_CONVERTED,
  summary: `Converted lead "${args.leadName}" to client "${args.clientName}"`,
  metadata: toMetadata({
    conversion: {
      leadId: args.leadId,
      clientId: args.clientId,
      clientName: args.clientName,
    },
  }),
})
