'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { clientUpdatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
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
    const [existing] = await db
      .select({ name: clients.name, notes: clients.notes })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    if (!existing) {
      return { success: false, error: 'Client not found.' }
    }

    const previousNotes = existing.notes ?? null

    if (previousNotes === normalizedNotes) {
      return { success: true }
    }

    await db
      .update(clients)
      .set({
        notes: normalizedNotes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.id, clientId))

    const event = clientUpdatedEvent({
      name: existing.name,
      changedFields: ['notes'],
      details: {
        before: { notes: previousNotes },
        after: { notes: normalizedNotes },
      },
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'CLIENT',
      targetId: clientId,
      targetClientId: clientId,
      metadata: event.metadata,
    })

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
// ─────────────────────────────────────────────────────────────────────────────
// Contact Selector Actions
// ─────────────────────────────────────────────────────────────────────────────

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
