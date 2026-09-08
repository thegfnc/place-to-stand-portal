'use server'

import { asc, eq, and, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientMembers, contacts, contactClients, users } from '@/lib/db/schema'

type ContactOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  hasPortalAccess: boolean
}

type AdminUserOption = {
  id: string
  fullName: string | null
  email: string
}

export type ClientSheetContactData = {
  allContacts: ContactOption[]
  linkedContacts: ContactOption[]
  allAdminUsers: AdminUserOption[]
}

/**
 * Fetches all active contacts for use in the client sheet contact picker.
 */
async function listAllActiveContacts(
  user: AppUser
): Promise<ContactOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      userId: contacts.userId,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(contacts.name), asc(contacts.email))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasPortalAccess: Boolean(row.userId),
  }))
}

/**
 * Fetches the contacts linked to a specific client.
 */
async function listClientContacts(
  user: AppUser,
  clientId: string
): Promise<ContactOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      userId: contacts.userId,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
    .where(
      and(
        eq(contactClients.clientId, clientId),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(asc(contacts.name), asc(contacts.email))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasPortalAccess: Boolean(row.userId),
  }))
}

/**
 * Fetches all active ADMIN users for use in origination + closer pickers.
 */
async function listAllAdminUsers(
  user: AppUser
): Promise<AdminUserOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.role, 'ADMIN'), isNull(users.deletedAt)))
    .orderBy(asc(users.fullName), asc(users.email))

  return rows.map(row => ({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
  }))
}

/**
 * Fetches all data needed for the client sheet contact and partner pickers.
 * If clientId is provided, also fetches the client's linked contacts.
 */
export async function getClientSheetContactData(
  user: AppUser,
  clientId?: string
): Promise<ClientSheetContactData> {
  assertAdmin(user)

  const [allContacts, linkedContacts, allAdminUsers] = await Promise.all([
    listAllActiveContacts(user),
    clientId ? listClientContacts(user, clientId) : Promise.resolve([]),
    listAllAdminUsers(user),
  ])

  return { allContacts, linkedContacts, allAdminUsers }
}

/**
 * Syncs the contact links for a client.
 * Adds new links and removes unlinked ones.
 * Also manages client_members for contacts that have portal accounts.
 */
export async function syncClientContacts(
  user: AppUser,
  clientId: string,
  contactIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  try {
    // Get current links
    const currentLinks = await db
      .select({ contactId: contactClients.contactId })
      .from(contactClients)
      .where(eq(contactClients.clientId, clientId))

    const currentIds = new Set(currentLinks.map(l => l.contactId))
    const newIds = new Set(contactIds)

    // Find links to add and remove
    const toAdd = contactIds.filter(id => !currentIds.has(id))
    const toRemove = [...currentIds].filter(id => !newIds.has(id))

    // Perform the contact-client link updates
    if (toAdd.length > 0) {
      await db.insert(contactClients).values(
        toAdd.map(contactId => ({
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
            eq(contactClients.clientId, clientId),
            inArray(contactClients.contactId, toRemove)
          )
        )
    }

    // Sync client_members for contacts with portal accounts
    await syncPortalMemberships(clientId, toAdd, toRemove)

    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to update contact links.' }
  }
}

/**
 * When contacts are linked/unlinked from a client, ensure their portal
 * access (client_members) stays in sync. Contacts with a userId get
 * a client_members record; unlinking soft-deletes it.
 */
async function syncPortalMemberships(
  clientId: string,
  addedContactIds: string[],
  removedContactIds: string[]
) {
  // For added contacts, find those with portal accounts and upsert client_members
  if (addedContactIds.length > 0) {
    const portalContacts = await db
      .select({ userId: contacts.userId })
      .from(contacts)
      .where(
        and(
          inArray(contacts.id, addedContactIds),
          isNull(contacts.deletedAt)
        )
      )

    const userIdsToAdd = portalContacts
      .map(c => c.userId)
      .filter((id): id is string => id !== null)

    if (userIdsToAdd.length > 0) {
      await db
        .insert(clientMembers)
        .values(userIdsToAdd.map(userId => ({ clientId, userId, deletedAt: null })))
        .onConflictDoUpdate({
          target: [clientMembers.clientId, clientMembers.userId],
          set: { deletedAt: null },
        })
    }
  }

  // For removed contacts, find those with portal accounts and soft-delete client_members
  if (removedContactIds.length > 0) {
    const portalContacts = await db
      .select({ userId: contacts.userId })
      .from(contacts)
      .where(
        and(
          inArray(contacts.id, removedContactIds),
          isNull(contacts.deletedAt)
        )
      )

    const userIdsToRemove = portalContacts
      .map(c => c.userId)
      .filter((id): id is string => id !== null)

    if (userIdsToRemove.length > 0) {
      await db
        .update(clientMembers)
        .set({ deletedAt: new Date().toISOString() })
        .where(
          and(
            eq(clientMembers.clientId, clientId),
            inArray(clientMembers.userId, userIdsToRemove),
            isNull(clientMembers.deletedAt)
          )
        )
    }
  }
}
