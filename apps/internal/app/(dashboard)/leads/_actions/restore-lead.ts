'use server'

import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { leadRestoredEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const restoreLeadSchema = z.object({
  leadId: z.string().uuid(),
})

export type RestoreLeadInput = z.infer<typeof restoreLeadSchema>

export async function restoreLead(
  input: RestoreLeadInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = restoreLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid lead reference.',
    }
  }

  try {
    const result = await db
      .update(leads)
      .set({
        deletedAt: null,
      })
      .where(and(eq(leads.id, parsed.data.leadId), isNotNull(leads.deletedAt)))
      .returning({ id: leads.id, contactName: leads.contactName })

    const restored = result[0]

    if (!restored) {
      return { success: false, error: 'Lead not found in archive.' }
    }

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      targetType: 'LEAD',
      targetId: restored.id,
      ...leadRestoredEvent({ name: restored.contactName }),
    })
  } catch (error) {
    console.error('Failed to restore lead', error)
    return {
      success: false,
      error: 'Unable to restore lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
