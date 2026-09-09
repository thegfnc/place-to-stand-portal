'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { leadUpdateEditedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leadUpdates } from '@/lib/db/schema'
import { LEAD_UPDATE_LABELS } from '@/lib/leads/updates'
import { getLeadUpdateForLead } from '@/lib/queries/lead-updates'

import type { LeadActionResult } from '../types'
import { revalidateLeadsPath } from '../utils'
import {
  findActiveLead,
  leadUpdateBodySchema,
  leadUpdateTypeSchema,
  occurredAtSchema,
} from './shared'

const updateLeadUpdateSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  type: leadUpdateTypeSchema,
  body: leadUpdateBodySchema,
  occurredAt: occurredAtSchema,
})

export type UpdateLeadUpdateInput = z.infer<typeof updateLeadUpdateSchema>

export async function updateLeadUpdate(
  input: UpdateLeadUpdateInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = updateLeadUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid update payload.',
    }
  }

  const { id, leadId, type, body, occurredAt } = parsed.data

  const lead = await findActiveLead(leadId)

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  // Verify the update belongs to THIS lead — the id alone is not trustworthy.
  const existing = await getLeadUpdateForLead(id, leadId)

  if (!existing) {
    return { success: false, error: 'Update not found.' }
  }

  const changedFields: string[] = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  if (existing.type !== type) {
    changedFields.push('type')
    before.type = existing.type
    after.type = type
  }

  if (existing.body !== body) {
    changedFields.push('body')
    before.body = existing.body
    after.body = body
  }

  if (!sameInstant(existing.occurredAt, occurredAt)) {
    changedFields.push('date')
    before.occurredAt = existing.occurredAt
    after.occurredAt = occurredAt
  }

  if (!changedFields.length) {
    return { success: true, leadId }
  }

  try {
    await db
      .update(leadUpdates)
      .set({
        type,
        body,
        occurredAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leadUpdates.id, id))

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      targetType: 'LEAD',
      targetId: leadId,
      ...leadUpdateEditedEvent({
        contactName: lead.contactName,
        updateId: id,
        typeLabel: LEAD_UPDATE_LABELS[type],
        changedFields,
        details: { before, after },
      }),
    })

    revalidateLeadsPath()

    return { success: true, leadId }
  } catch (error) {
    console.error('Failed to update lead update:', error)
    return {
      success: false,
      error: 'Unable to save update. Please try again.',
    }
  }
}

/**
 * Postgres returns timestamptz as a string that need not match the ISO form
 * the browser sent, so compare the instants rather than the strings.
 */
function sameInstant(left: string, right: string): boolean {
  const a = new Date(left).getTime()
  const b = new Date(right).getTime()
  return Number.isNaN(a) || Number.isNaN(b) ? left === right : a === b
}
