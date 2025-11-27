'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { captureServerEvent } from '@/lib/posthog/server'

import { leadFormSchema, type LeadFormValues } from '../lead-schema'
import type { LeadMutationResult } from '../lead-types'

/**
 * Create or update a lead.
 */
export async function saveLead(
  input: LeadFormValues
): Promise<LeadMutationResult> {
  const user = await requireRole('ADMIN')
  const parsed = leadFormSchema.safeParse(input)

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Please correct the highlighted fields.'
    return { error: message }
  }

  const { id, name, status, source, ownerId, contactEmail, contactPhone, notes } =
    parsed.data

  const trimmedName = name.trim()

  if (!trimmedName) {
    return { error: 'Lead name is required.' }
  }

  const normalizedEmail = contactEmail?.trim() || null
  const normalizedPhone = contactPhone?.trim() || null
  const normalizedSource = source?.trim() || null
  const normalizedNotes = notes ?? {}

  const isEditing = Boolean(id)

  try {
    if (isEditing) {
      // Update existing lead
      await db
        .update(leads)
        .set({
          name: trimmedName,
          status,
          source: normalizedSource,
          ownerId: ownerId || null,
          contactEmail: normalizedEmail,
          contactPhone: normalizedPhone,
          notes: normalizedNotes,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(leads.id, id!))

      await captureServerEvent({
        event: 'lead_updated',
        properties: {
          leadId: id,
          status,
        },
        distinctId: user.id,
      })

      revalidatePath('/leads')

      return { leadId: id }
    } else {
      // Create new lead
      const inserted = await db
        .insert(leads)
        .values({
          name: trimmedName,
          status,
          source: normalizedSource,
          ownerId: ownerId || null,
          contactEmail: normalizedEmail,
          contactPhone: normalizedPhone,
          notes: normalizedNotes,
        })
        .returning({ id: leads.id })

      const leadId = inserted[0]?.id

      if (!leadId) {
        console.error('Lead created without returning identifier')
        return { error: 'Unable to create lead.' }
      }

      await captureServerEvent({
        event: 'lead_created',
        properties: {
          leadId,
          status,
        },
        distinctId: user.id,
      })

      revalidatePath('/leads')

      return { leadId }
    }
  } catch (error) {
    console.error('Failed to save lead', error)
    return {
      error: error instanceof Error ? error.message : 'Unable to save lead.',
    }
  }
}

