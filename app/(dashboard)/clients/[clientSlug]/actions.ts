'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

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

