import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'
import { LEAD_STATUS_LABELS, type LeadStatusValue } from '@/lib/leads/constants'

import { joinWithCommas, toMetadata } from './shared'

const leadStatusLabel = (status: string): string =>
  LEAD_STATUS_LABELS[status as LeadStatusValue] ?? status

export const leadCreatedEvent = (args: {
  name: string
  source?: string | null
  status?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_CREATED,
  summary: `Created lead "${args.name}"`,
  metadata: toMetadata({
    lead: {
      name: args.name,
      source: args.source ?? null,
      status: args.status ?? undefined,
    },
  }),
})

export const leadUpdatedEvent = (args: {
  name: string
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_UPDATED,
  summary: `Updated lead "${args.name}"${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const leadStatusChangedEvent = (args: {
  name: string
  fromStatus: string
  toStatus: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_STATUS_CHANGED,
  summary: `Moved lead "${args.name}" from ${leadStatusLabel(args.fromStatus)} to ${leadStatusLabel(args.toStatus)}`,
  metadata: toMetadata({
    changedFields: ['status'],
    details: {
      before: { status: args.fromStatus },
      after: { status: args.toStatus },
    },
  }),
})

export const leadArchivedEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_ARCHIVED,
  summary: `Archived lead "${args.name}"`,
})

export const leadRestoredEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_RESTORED,
  summary: `Restored lead "${args.name}"`,
})

export const leadDeletedEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_DELETED,
  summary: `Permanently deleted lead "${args.name}"`,
})

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

export const leadUpdateEditedEvent = (args: {
  contactName: string
  updateId: string
  typeLabel: string
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_UPDATE_EDITED,
  summary: `Edited ${args.typeLabel.toLowerCase()} on lead "${args.contactName}"${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    update: { id: args.updateId },
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const leadUpdateDeletedEvent = (args: {
  contactName: string
  updateId: string
  type: string
  typeLabel: string
  occurredAt: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_UPDATE_DELETED,
  summary: `Deleted ${args.typeLabel.toLowerCase()} on lead "${args.contactName}"`,
  metadata: toMetadata({
    update: {
      id: args.updateId,
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
