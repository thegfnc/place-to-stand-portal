import 'server-only'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contactClients, contacts } from '@/lib/db/schema'

export type ClientContactSummary = {
  id: string
  name: string | null
  email: string
}

/**
 * Live contacts linked to each client, keyed by client id — one grouped
 * query for the clients landing Contacts column. `contact_clients` has no
 * soft-delete column (links are hard-deleted on unlink), so only the
 * contact's own `deleted_at` is filtered.
 */
export async function fetchContactSummariesByClient(
  clientIds: string[]
): Promise<Map<string, ClientContactSummary[]>> {
  const result = new Map<string, ClientContactSummary[]>()
  if (clientIds.length === 0) {
    return result
  }

  const rows = await db
    .select({
      clientId: contactClients.clientId,
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
    .where(
      and(
        inArray(contactClients.clientId, clientIds),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(asc(contacts.name), asc(contacts.email))

  for (const row of rows) {
    const existing = result.get(row.clientId) ?? []
    existing.push({ id: row.id, name: row.name, email: row.email })
    result.set(row.clientId, existing)
  }

  return result
}
