import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

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

export const clientRestoredEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_RESTORED,
  summary: `Restored client "${args.name}"`,
})

export const clientDeletedEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_DELETED,
  summary: `Permanently deleted client "${args.name}"`,
})
