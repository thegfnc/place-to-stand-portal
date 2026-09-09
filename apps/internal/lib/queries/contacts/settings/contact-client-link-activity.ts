import 'server-only'

import { inArray } from 'drizzle-orm'

import {
  contactClientLinkedEvent,
  contactClientUnlinkedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, contacts } from '@/lib/db/schema'

export type ContactClientLinkChange = {
  contactId: string
  clientId: string
  action: 'linked' | 'unlinked'
}

/**
 * Records one CONTACT_CLIENT_LINKED / _UNLINKED row per (contact, client)
 * pair after a link sync has landed. Both sync directions (contact sheet and
 * client sheet) call this so the feed reads the same either way. Names are
 * looked up here rather than threaded in: the sync helpers only hold ids.
 */
export async function logContactClientLinkChanges(
  user: AppUser,
  changes: ContactClientLinkChange[]
): Promise<void> {
  if (changes.length === 0) return

  const contactIds = [...new Set(changes.map(change => change.contactId))]
  const clientIds = [...new Set(changes.map(change => change.clientId))]

  let contactRows: { id: string; name: string | null; email: string }[]
  let clientRows: { id: string; name: string }[]

  try {
    ;[contactRows, clientRows] = await Promise.all([
      db
        .select({ id: contacts.id, name: contacts.name, email: contacts.email })
        .from(contacts)
        .where(inArray(contacts.id, contactIds)),
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(inArray(clients.id, clientIds)),
    ])
  } catch (error) {
    // The links already landed; like `logActivity`, never fail the caller.
    console.error('Failed to resolve names for contact link activity', {
      contactIds,
      clientIds,
      error,
    })
    return
  }

  const contactsById = new Map(contactRows.map(row => [row.id, row]))
  const clientsById = new Map(clientRows.map(row => [row.id, row]))

  for (const change of changes) {
    const contact = contactsById.get(change.contactId)
    const client = clientsById.get(change.clientId)
    if (!contact || !client) continue

    const args = {
      contact: { name: contact.name, email: contact.email },
      client: { name: client.name },
    }
    const event =
      change.action === 'linked'
        ? contactClientLinkedEvent(args)
        : contactClientUnlinkedEvent(args)

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'CONTACT',
      targetId: change.contactId,
      targetClientId: change.clientId,
      metadata: event.metadata,
    })
  }
}
