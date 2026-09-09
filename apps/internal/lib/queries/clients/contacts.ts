import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, contactClients } from '@/lib/db/schema'

export type ClientContactRow = {
  id: string
  email: string
  name: string
  phone: string | null
  createdBy: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  isPrimary: boolean
}

/**
 * Contacts linked to a client through `contact_clients`, primary first then
 * by email. Shared by the client detail page and the update composer so both
 * agree on who a client's people are.
 */
export async function fetchContactsForClient(
  clientId: string
): Promise<ClientContactRow[]> {
  return db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
      createdBy: contacts.createdBy,
      userId: contacts.userId,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      deletedAt: contacts.deletedAt,
      isPrimary: contactClients.isPrimary,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
    .where(
      and(eq(contactClients.clientId, clientId), isNull(contacts.deletedAt))
    )
    .orderBy(desc(contactClients.isPrimary), contacts.email)
}
