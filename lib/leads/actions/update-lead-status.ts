'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { captureServerEvent } from '@/lib/posthog/server'

import { leadStatusUpdateSchema, type LeadStatusUpdate } from '../lead-schema'
import type { LeadMutationResult } from '../lead-types'

/**
 * Update a lead's status (e.g., via drag and drop).
 */
export async function updateLeadStatus(
  input: LeadStatusUpdate
): Promise<LeadMutationResult> {
  const user = await requireRole('ADMIN')
  const parsed = leadStatusUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid status update.' }
  }

  const { leadId, status } = parsed.data

  try {
    await db
      .update(leads)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leads.id, leadId))

    await captureServerEvent({
      event: 'lead_status_changed',
      properties: {
        leadId,
        newStatus: status,
      },
      distinctId: user.id,
    })

    revalidatePath('/leads/board')

    return { leadId }
  } catch (error) {
    console.error('Failed to update lead status', error)
    return {
      error:
        error instanceof Error ? error.message : 'Unable to update lead status.',
    }
  }
}

