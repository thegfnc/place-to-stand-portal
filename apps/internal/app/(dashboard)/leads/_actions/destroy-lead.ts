'use server'

import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { leadDeletedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const destroyLeadSchema = z.object({
  leadId: z.string().uuid(),
})

export type DestroyLeadInput = z.infer<typeof destroyLeadSchema>

export async function destroyLead(
  input: DestroyLeadInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = destroyLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid lead reference.',
    }
  }

  try {
    const result = await db
      .delete(leads)
      .where(and(eq(leads.id, parsed.data.leadId), isNotNull(leads.deletedAt)))
      // RETURNING captures the name from the row being deleted so it is
      // available for the audit entry after the row is gone.
      .returning({ id: leads.id, contactName: leads.contactName })

    const deleted = result[0]

    if (!deleted) {
      return { success: false, error: 'Lead not found in archive.' }
    }

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      targetType: 'LEAD',
      targetId: deleted.id,
      ...leadDeletedEvent({ name: deleted.contactName }),
    })
  } catch (error) {
    console.error('Failed to permanently delete lead', error)
    return {
      success: false,
      error: 'Unable to delete lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
