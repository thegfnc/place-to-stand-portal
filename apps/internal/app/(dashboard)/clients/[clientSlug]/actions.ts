'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contacts, contactClients } from '@/lib/db/schema'
import { searchContacts, type SearchContactResult } from '@/lib/queries/contacts/search-contacts'
import { createUpdateDraft } from '@/lib/updates'

const updateClientNotesSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  notes: z.string().nullable(),
})

export type UpdateClientNotesInput = z.infer<typeof updateClientNotesSchema>

export type UpdateClientNotesResult = {
  success: boolean
  error?: string
}

export async function updateClientNotes(
  input: UpdateClientNotesInput
): Promise<UpdateClientNotesResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = updateClientNotesSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const { clientId, notes } = parsed.data
  const normalizedNotes = notes?.trim() || null

  try {
    await db
      .update(clients)
      .set({
        notes: normalizedNotes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.id, clientId))

    revalidatePath(`/clients`)
    revalidatePath(`/clients/${clientId}`)

    return { success: true }
  } catch (error) {
    console.error('Failed to update client notes:', error)
    return {
      success: false,
      error: 'Failed to save notes. Please try again.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Contacts (using junction table approach)
// ─────────────────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  name: z.string().min(1, 'Name is required').max(100).transform(v => v.trim()),
  isPrimary: z.boolean().default(false),
})

export type ContactActionResult = { success: true; id: string } | { success: false; error: string }

export async function addClientContact(input: z.infer<typeof contactSchema>): Promise<ContactActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    // Find existing contact by email or create new one
    const [existingContact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.email, parsed.data.email), isNull(contacts.deletedAt)))
      .limit(1)

    let contactId: string
    if (existingContact) {
      contactId = existingContact.id
      // Update name if provided and different
      if (parsed.data.name) {
        await db.update(contacts)
          .set({ name: parsed.data.name, updatedAt: new Date().toISOString() })
          .where(eq(contacts.id, contactId))
      }
    } else {
      // Create new contact
      const [newContact] = await db.insert(contacts).values({
        email: parsed.data.email,
        name: parsed.data.name,
        createdBy: user.id,
      }).returning({ id: contacts.id })
      contactId = newContact.id
    }

    // Create junction record linking contact to client
    await db.insert(contactClients).values({
      contactId,
      clientId: parsed.data.clientId,
      isPrimary: parsed.data.isPrimary,
    })

    revalidatePath(`/clients`)
    return { success: true, id: contactId }
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return { success: false, error: 'This email is already added to this client' }
    }
    return { success: false, error: 'Failed to add contact' }
  }
}

export async function updateClientContact(
  contactId: string,
  clientId: string,
  input: Omit<z.infer<typeof contactSchema>, 'clientId'>
): Promise<ContactActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = contactSchema.omit({ clientId: true }).safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    // Update contact details
    await db.update(contacts)
      .set({
        email: parsed.data.email,
        name: parsed.data.name,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))

    // Update isPrimary in junction table
    await db.update(contactClients)
      .set({ isPrimary: parsed.data.isPrimary })
      .where(and(
        eq(contactClients.contactId, contactId),
        eq(contactClients.clientId, clientId)
      ))

    revalidatePath(`/clients`)
    return { success: true, id: contactId }
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return { success: false, error: 'This email is already in use' }
    }
    return { success: false, error: 'Failed to update contact' }
  }
}

export async function deleteClientContact(
  contactId: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser()
  assertAdmin(user)

  // Delete the junction record (removes link between contact and client)
  // The contact itself remains available for linking to other clients
  await db.delete(contactClients)
    .where(and(
      eq(contactClients.contactId, contactId),
      eq(contactClients.clientId, clientId)
    ))

  revalidatePath(`/clients`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact Selector Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllContacts(): Promise<SearchContactResult[]> {
  const user = await requireUser()
  assertAdmin(user)
  return searchContacts(user)
}

const linkContactSchema = z.object({
  contactId: z.string().uuid(),
  clientId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
})

export async function linkContactToClient(
  input: z.infer<typeof linkContactSchema>
): Promise<ContactActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = linkContactSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    await db.insert(contactClients).values({
      contactId: parsed.data.contactId,
      clientId: parsed.data.clientId,
      isPrimary: parsed.data.isPrimary,
    })

    revalidatePath(`/clients`)
    return { success: true, id: parsed.data.contactId }
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return { success: false, error: 'This contact is already linked to this client' }
    }
    return { success: false, error: 'Failed to link contact' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Updates
// ─────────────────────────────────────────────────────────────────────────────

export type DraftUpdateResult =
  | { success: true; id: string }
  | { success: false; error: string }

/**
 * Starts a draft update for the client. The draft is generated the same way
 * as `pts updates draft` — see `lib/updates` — and the caller navigates to it.
 */
export async function draftUpdateForClient(
  clientId: string
): Promise<DraftUpdateResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = z.string().uuid().safeParse(clientId)
  if (!parsed.success) return { success: false, error: 'Invalid client id' }

  try {
    const update = await createUpdateDraft(user, { clientRef: parsed.data })
    revalidatePath(`/clients`)
    return { success: true, id: update.id }
  } catch (error) {
    console.error('Failed to draft client update:', error)
    return { success: false, error: 'Failed to generate the draft. Please try again.' }
  }
}
