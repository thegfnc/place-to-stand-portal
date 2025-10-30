import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

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

export const userDeletedEvent = (args: {
  fullName: string
  email?: string
  role?: string
}): ActivityEvent => ({
  verb: ActivityVerbs.USER_DELETED,
  summary: `Permanently deleted user ${args.fullName}`,
  metadata: toMetadata({
    email: args.email,
    role: args.role,
  }),
})
