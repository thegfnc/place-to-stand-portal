'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, clientContacts } from '@/lib/db/schema'

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
// Client Contacts
// ─────────────────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  name: z.string().max(100).optional().transform(v => v?.trim() || null),
  isPrimary: z.boolean().default(false),
})

export type ContactActionResult = { success: true; id: string } | { success: false; error: string }

export async function addClientContact(input: z.infer<typeof contactSchema>): Promise<ContactActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    const [contact] = await db.insert(clientContacts).values({
      clientId: parsed.data.clientId,
      email: parsed.data.email,
      name: parsed.data.name,
      isPrimary: parsed.data.isPrimary,
      createdBy: user.id,
    }).returning({ id: clientContacts.id })

    revalidatePath(`/clients`)
    return { success: true, id: contact.id }
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return { success: false, error: 'This email is already added to this client' }
    }
    return { success: false, error: 'Failed to add contact' }
  }
}

export async function updateClientContact(
  contactId: string,
  input: Omit<z.infer<typeof contactSchema>, 'clientId'>
): Promise<ContactActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = contactSchema.omit({ clientId: true }).safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    await db.update(clientContacts)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(and(eq(clientContacts.id, contactId), isNull(clientContacts.deletedAt)))

    revalidatePath(`/clients`)
    return { success: true, id: contactId }
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return { success: false, error: 'This email is already added to this client' }
    }
    return { success: false, error: 'Failed to update contact' }
  }
}

export async function deleteClientContact(contactId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser()
  assertAdmin(user)

  await db.update(clientContacts)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(clientContacts.id, contactId))

  revalidatePath(`/clients`)
  return { success: true }
}

