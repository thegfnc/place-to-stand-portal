'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { leadUpdateDeletedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leadUpdates } from '@/lib/db/schema'
import { LEAD_UPDATE_LABELS } from '@/lib/leads/updates'
import { getLeadUpdateForLead } from '@/lib/queries/lead-updates'

import type { LeadActionResult } from '../types'
import { revalidateLeadsPath } from '../utils'
import { findActiveLead } from './shared'

const deleteLeadUpdateSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
})

export type DeleteLeadUpdateInput = z.infer<typeof deleteLeadUpdateSchema>

export async function deleteLeadUpdate(
  input: DeleteLeadUpdateInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = deleteLeadUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid delete payload.',
    }
  }

  const { id, leadId } = parsed.data

  const lead = await findActiveLead(leadId)

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  const existing = await getLeadUpdateForLead(id, leadId)

  if (!existing) {
    return { success: false, error: 'Update not found.' }
  }

  try {
    // Soft delete only — an update is an audit record of who contacted whom.
    // The partial indexes and the last-touch aggregate both filter on
    // `deleted_at IS NULL`, so the row leaves every read path immediately.
    await db
      .update(leadUpdates)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(leadUpdates.id, id))

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      targetType: 'LEAD',
      targetId: leadId,
      ...leadUpdateDeletedEvent({
        contactName: lead.contactName,
        updateId: id,
        type: existing.type,
        typeLabel: LEAD_UPDATE_LABELS[existing.type],
        occurredAt: existing.occurredAt,
      }),
    })

    revalidateLeadsPath()

    return { success: true, leadId }
  } catch (error) {
    console.error('Failed to delete lead update:', error)
    return {
      success: false,
      error: 'Unable to delete update. Please try again.',
    }
  }
}
