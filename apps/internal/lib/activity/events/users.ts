import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

export const userCreatedEvent = (args: {
  fullName: string
  role: string
  email?: string
  /** Clients a portal user was granted access to on creation. */
  clientIds?: string[]
}): ActivityEvent => ({
  verb: ActivityVerbs.USER_CREATED,
  summary: `Invited ${args.fullName} (${args.role})`,
  metadata: toMetadata({
    role: args.role,
    email: args.email,
    clientIds: args.clientIds,
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

export const userPasswordChangedEvent = (args: {
  fullName: string
  /** Where the change came from: the profile sheet or the reset flow. */
  context: 'profile' | 'reset'
}): ActivityEvent => ({
  verb: ActivityVerbs.USER_PASSWORD_CHANGED,
  summary:
    args.context === 'reset'
      ? `${args.fullName} completed a password reset`
      : `${args.fullName} changed their password`,
  metadata: toMetadata({
    changedFields: ['password'],
    context: args.context,
  }),
})
