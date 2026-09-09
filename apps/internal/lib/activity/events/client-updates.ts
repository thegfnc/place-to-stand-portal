import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

type Recipients = { to: string[]; cc: string[] }

const recipientCount = (recipients: Recipients) =>
  recipients.to.length + recipients.cc.length

/**
 * Top-level `subject` / `recipientCount` are what the feed surfaces as chips;
 * the rest rides along for the audit trail.
 */
export const clientUpdateDraftedEvent = (args: {
  clientName: string
  subject: string
  recipients: Recipients
  itemCount: number
  periodStart: string
  periodEnd: string
}): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_UPDATE_DRAFTED,
  summary: `Drafted update "${args.subject}" for ${args.clientName}`,
  metadata: toMetadata({
    subject: args.subject,
    recipientCount: recipientCount(args.recipients),
    update: {
      itemCount: args.itemCount,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      recipientEmails: args.recipients,
    },
  }),
})

export const clientUpdateEditedEvent = (args: {
  subject: string
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
  /** Email addresses added to / removed from the to+cc lists. */
  recipientChanges?: { added: string[]; removed: string[] }
}): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_UPDATE_EDITED,
  summary: `Edited update "${args.subject}"${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
    recipients: args.recipientChanges,
  }),
})

export const clientUpdateSentEvent = (args: {
  clientName: string
  subject: string
  recipients: Recipients
  itemCount: number
  gmailMessageId: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_UPDATE_SENT,
  summary: `Sent update "${args.subject}" to ${args.clientName}`,
  metadata: toMetadata({
    subject: args.subject,
    recipientCount: recipientCount(args.recipients),
    update: {
      itemCount: args.itemCount,
      recipientEmails: args.recipients,
      gmailMessageId: args.gmailMessageId,
    },
  }),
})
