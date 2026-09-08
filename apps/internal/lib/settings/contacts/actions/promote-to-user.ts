import { and, eq, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactInvitedToPortalEvent } from '@/lib/activity/events/contacts'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientMembers, contactClients, contacts } from '@/lib/db/schema'
import { findOrCreatePortalUser } from '@/lib/settings/users/services/find-or-create-portal-user'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export type PromoteToUserInput = {
  contactId: string
}

export async function promoteContactToUserMutation(
  context: ContactMutationContext,
  input: PromoteToUserInput
): Promise<ContactMutationResult> {
  const { user } = context

  try {
    assertAdmin(user)
  } catch (error) {
    if (error instanceof Error) {
      return buildMutationResult({ error: error.message })
    }
    return buildMutationResult({ error: 'Admin privileges required.' })
  }

  // 1. Load and validate contact
  const [contact] = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      userId: contacts.userId,
      deletedAt: contacts.deletedAt,
    })
    .from(contacts)
    .where(eq(contacts.id, input.contactId))
    .limit(1)

  if (!contact) {
    return buildMutationResult({ error: 'Contact not found.' })
  }

  if (contact.deletedAt) {
    return buildMutationResult({ error: 'Cannot promote an archived contact.' })
  }

  if (contact.userId) {
    return buildMutationResult({
      error: 'This contact already has portal access.',
    })
  }

  // 2. Find or create portal user
  const portalResult = await findOrCreatePortalUser(user, {
    email: contact.email,
    fullName: contact.name,
  })

  if (portalResult.error || !portalResult.userId) {
    return buildMutationResult({
      error: portalResult.error ?? 'Failed to create portal user.',
    })
  }

  const userId = portalResult.userId

  // 3. Link contact to user
  await db
    .update(contacts)
    .set({
      userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(contacts.id, contact.id))

  // 4. Grant portal access to linked clients
  const linkedClients = await db
    .select({ clientId: contactClients.clientId })
    .from(contactClients)
    .innerJoin(contacts, and(
      eq(contactClients.contactId, contacts.id),
      isNull(contacts.deletedAt)
    ))
    .where(eq(contactClients.contactId, contact.id))

  if (linkedClients.length > 0) {
    await db
      .insert(clientMembers)
      .values(linkedClients.map(lc => ({
        clientId: lc.clientId,
        userId,
        deletedAt: null,
      })))
      .onConflictDoUpdate({
        target: [clientMembers.clientId, clientMembers.userId],
        set: { deletedAt: null },
      })
  }

  // 5. Log activity event
  const contactEvent = contactInvitedToPortalEvent({
    email: contact.email,
    name: contact.name,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: contactEvent.verb,
    summary: contactEvent.summary,
    targetType: 'CONTACT',
    targetId: contact.id,
    metadata: contactEvent.metadata,
  })

  return buildMutationResult({})
}
