'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { captureServerEvent } from '@/lib/posthog/server'

import type { LeadMutationResult } from '../lead-types'

/**
 * Soft delete a lead.
 */
export async function deleteLead(leadId: string): Promise<LeadMutationResult> {
  const user = await requireRole('ADMIN')

  if (!leadId) {
    return { error: 'Lead ID is required.' }
  }

  try {
    await db
      .update(leads)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leads.id, leadId))

    await captureServerEvent({
      event: 'lead_deleted',
      properties: {
        leadId,
      },
      distinctId: user.id,
    })

    revalidatePath('/leads')

    return { leadId }
  } catch (error) {
    console.error('Failed to delete lead', error)
    return {
      error: error instanceof Error ? error.message : 'Unable to delete lead.',
    }
  }
}

