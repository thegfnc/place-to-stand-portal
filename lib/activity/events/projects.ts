import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

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

export const projectRestoredEvent = (args: {
  name: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PROJECT_RESTORED,
  summary: `Restored project "${args.name}"`,
})

export const projectDeletedEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.PROJECT_DELETED,
  summary: `Permanently deleted project "${args.name}"`,
})
