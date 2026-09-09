'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { leadStatusChangedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, leadStageHistory } from '@/lib/db/schema'
import { LEAD_STATUS_VALUES, isTerminalLeadStatus } from '@/lib/leads/constants'
import { normalizeRank } from '@/lib/rank'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const moveLeadSchema = z.object({
  leadId: z.string().uuid(),
  targetStatus: z.enum(LEAD_STATUS_VALUES),
  rank: z.string().min(1, 'Rank is required'),
})

export type MoveLeadInput = z.infer<typeof moveLeadSchema>

export async function moveLead(input: MoveLeadInput): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = moveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid update payload.',
    }
  }

  let normalizedRank: string

  try {
    normalizedRank = normalizeRank(parsed.data.rank)
  } catch (error) {
    console.error('Invalid rank provided for lead reorder', error)
    return {
      success: false,
      error: 'Unable to reorder lead with invalid rank.',
    }
  }

  try {
    // Fetch current status before update
    const currentRows = await db
      .select({ status: leads.status, contactName: leads.contactName })
      .from(leads)
      .where(and(eq(leads.id, parsed.data.leadId), isNull(leads.deletedAt)))
      .limit(1)

    const current = currentRows[0]
    if (!current) {
      return { success: false, error: 'Lead not found.' }
    }

    const now = new Date().toISOString()
    const statusChanged = current.status !== parsed.data.targetStatus

    const setPayload: Record<string, unknown> = {
      status: parsed.data.targetStatus,
      rank: normalizedRank,
      updatedAt: now,
    }

    if (statusChanged) {
      setPayload.currentStageEnteredAt = now

      if (isTerminalLeadStatus(parsed.data.targetStatus)) {
        setPayload.resolvedAt = now
      }

      if (parsed.data.targetStatus === 'CLOSED_WON') {
        // Only set convertedAt if not already set
        const fullLead = await db
          .select({ convertedAt: leads.convertedAt })
          .from(leads)
          .where(eq(leads.id, parsed.data.leadId))
          .limit(1)

        if (fullLead[0] && !fullLead[0].convertedAt) {
          setPayload.convertedAt = now
        }
      }

      // Reset conversion/resolution fields when moving back to an active stage
      if (isTerminalLeadStatus(current.status) && !isTerminalLeadStatus(parsed.data.targetStatus)) {
        setPayload.resolvedAt = null
        setPayload.convertedAt = null
        setPayload.convertedToClientId = null
        setPayload.lossReason = null
        setPayload.lossNotes = null
      }
    }

    await db
      .update(leads)
      .set(setPayload)
      .where(and(eq(leads.id, parsed.data.leadId), isNull(leads.deletedAt)))

    // Record stage history if status changed
    if (statusChanged) {
      await db.insert(leadStageHistory).values({
        leadId: parsed.data.leadId,
        fromStatus: current.status,
        toStatus: parsed.data.targetStatus,
        changedAt: now,
        changedBy: user.id,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        targetType: 'LEAD',
        targetId: parsed.data.leadId,
        ...leadStatusChangedEvent({
          name: current.contactName,
          fromStatus: current.status,
          toStatus: parsed.data.targetStatus,
        }),
      })
    }
  } catch (error) {
    console.error('Failed to reorder lead', error)
    return {
      success: false,
      error: 'Unable to update lead ordering.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
