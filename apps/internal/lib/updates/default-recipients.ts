import 'server-only'

import type { ClientContactRow } from '@/lib/queries/clients/contacts'

import type { StaffMember } from './staff'
import type { ClientUpdateRecipients } from './types'

/**
 * Everyone linked to the client, primary contacts first. This is a starting
 * point the composer shows as editable checkboxes, not a rule — the review
 * step is where the list gets curated.
 */
export function recipientsFromContacts(
  contacts: ClientContactRow[],
  staff: StaffMember[],
  /** The sender — already gets the message in Sent, so not cc'd to themselves. */
  senderId: string
): ClientUpdateRecipients {
  const to = uniqueEmails(contacts.map(contact => contact.email))
  const cc = uniqueEmails(
    staff.filter(member => member.id !== senderId).map(member => member.email)
  ).filter(email => !to.includes(email))

  return { to, cc }
}

function uniqueEmails(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const email = value.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

/**
 * Who the email opens to: the primary contact's first name, falling back to
 * the first linked contact, then to nothing (the body says "Hi there,").
 * Contacts are already ordered primary-first by `fetchContactsForClient`.
 */
export function greetingNameFromContacts(
  contacts: ClientContactRow[]
): string | null {
  const name = contacts[0]?.name.trim()
  if (!name) return null
  return name.split(/\s+/)[0] ?? null
}
