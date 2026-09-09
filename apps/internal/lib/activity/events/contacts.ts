import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const contactCreatedEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_CREATED,
  summary: `Created contact "${args.name || args.email}"`,
  metadata: toMetadata({
    contact: {
      email: args.email,
      name: args.name,
    },
  }),
})

export const contactUpdatedEvent = (args: {
  email: string
  name: string | null
  changedFields: string[]
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_UPDATED,
  summary: `Updated contact "${args.name || args.email}"${
    args.changedFields.length ? ` (${args.changedFields.join(', ')})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const contactArchivedEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_ARCHIVED,
  summary: `Archived contact "${args.name || args.email}"`,
})

export const contactRestoredEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_RESTORED,
  summary: `Restored contact "${args.name || args.email}"`,
})

export const contactDeletedEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_DELETED,
  summary: `Permanently deleted contact "${args.name || args.email}"`,
})

export const contactInvitedToPortalEvent = (args: {
  email: string
  name: string | null
  /** Clients the new portal user was granted access to. */
  clientIds?: string[]
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_INVITED_TO_PORTAL,
  summary: `Invited contact "${args.name || args.email}" to the client portal`,
  metadata: toMetadata({
    contact: { email: args.email, name: args.name },
    clientIds: args.clientIds,
  }),
})

type ContactClientLinkArgs = {
  contact: { name: string | null; email: string }
  client: { name: string }
}

export const contactClientLinkedEvent = (
  args: ContactClientLinkArgs
): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_CLIENT_LINKED,
  summary: `Linked contact "${args.contact.name || args.contact.email}" to ${args.client.name}`,
  metadata: toMetadata({
    contact: { name: args.contact.name, email: args.contact.email },
    client: { name: args.client.name },
  }),
})

export const contactClientUnlinkedEvent = (
  args: ContactClientLinkArgs
): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_CLIENT_UNLINKED,
  summary: `Unlinked contact "${args.contact.name || args.contact.email}" from ${args.client.name}`,
  metadata: toMetadata({
    contact: { name: args.contact.name, email: args.contact.email },
    client: { name: args.client.name },
  }),
})
