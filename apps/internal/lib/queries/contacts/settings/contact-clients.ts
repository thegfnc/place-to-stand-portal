'use server'

import { asc, eq, and, sql, inArray } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contactClients, contacts } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

export type ClientOption = {
  id: string
  name: string
  slug: string
}

export type ContactSheetInputRow = {
  id: string
  email: string
  name: string
  phone: string | null
}

/** Sheet row plus the archive flag the deep-link resolver needs. */
export type ContactDeepLinkRow = ContactSheetInputRow & {
  deletedAt: string | null
}

export type ContactSheetData = {
  allClients: ClientOption[]
  linkedClients: ClientOption[]
}

/**
 * Fetches all active clients for use in the contact sheet client picker.
 */
export async function listAllActiveClients(
  user: AppUser
): Promise<ClientOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
    })
    .from(clients)
    .where(sql`${clients.deletedAt} IS NULL`)
    .orderBy(asc(clients.name))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
  }))
}

/**
 * Fetches the clients linked to a specific contact.
 */
async function listContactClients(
  user: AppUser,
  contactId: string
): Promise<ClientOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
    })
    .from(contactClients)
    .innerJoin(clients, eq(contactClients.clientId, clients.id))
    .where(
      and(
        eq(contactClients.contactId, contactId),
        sql`${clients.deletedAt} IS NULL`
      )
    )
    .orderBy(asc(clients.name))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
  }))
}

/**
 * Fetches all data needed for the contact sheet client picker.
 * If contactId is provided, also fetches the contact's linked clients.
 */
export async function getContactSheetData(
  user: AppUser,
  contactId?: string
): Promise<ContactSheetData> {
  assertAdmin(user)

  const [allClients, linkedClients] = await Promise.all([
    listAllActiveClients(user),
    contactId ? listContactClients(user, contactId) : Promise.resolve([]),
  ])

  return { allClients, linkedClients }
}

/**
 * Fetches the minimal contact row the contact sheet needs — it self-fetches
 * its client links via `getContactSheetData`.
 */
export async function getContactSheetInputById(
  user: AppUser,
  contactId: string
): Promise<ContactSheetInputRow> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
    })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), sql`${contacts.deletedAt} IS NULL`))
    .limit(1)

  if (!rows.length) {
    throw new NotFoundError('Contact not found')
  }

  return rows[0]!
}

/**
 * By-id fetch that keeps archived contacts — the `?contact=` deep-link
 * resolver needs the soft-deleted row (and its `deletedAt`) so a shared link
 * can cross-redirect to the archive tab instead of reporting a dead link.
 */
export async function getContactDeepLinkRowById(
  user: AppUser,
  contactId: string
): Promise<ContactDeepLinkRow | null> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
      deletedAt: contacts.deletedAt,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Syncs the client links for a contact.
 * Adds new links and removes unlinked ones.
 */
export async function syncContactClients(
  user: AppUser,
  contactId: string,
  clientIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  try {
    // Get current links
    const currentLinks = await db
      .select({ clientId: contactClients.clientId })
      .from(contactClients)
      .where(eq(contactClients.contactId, contactId))

    const currentIds = new Set(currentLinks.map(l => l.clientId))
    const newIds = new Set(clientIds)

    // Find links to add and remove
    const toAdd = clientIds.filter(id => !currentIds.has(id))
    const toRemove = [...currentIds].filter(id => !newIds.has(id))

    // Perform the updates
    if (toAdd.length > 0) {
      await db.insert(contactClients).values(
        toAdd.map(clientId => ({
          contactId,
          clientId,
        }))
      )
    }

    if (toRemove.length > 0) {
      await db
        .delete(contactClients)
        .where(
          and(
            eq(contactClients.contactId, contactId),
            inArray(contactClients.clientId, toRemove)
          )
        )
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to update client links.' }
  }
}
