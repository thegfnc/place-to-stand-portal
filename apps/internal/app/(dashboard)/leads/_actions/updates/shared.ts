import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { LEAD_UPDATE_TYPES } from '@/lib/leads/updates'

// The body is TipTap HTML (like task_comments), so markup overhead counts
// toward this — same ceiling as the comments API.
const MAX_UPDATE_BODY_LENGTH = 10_000

export const leadUpdateTypeSchema = z.enum(LEAD_UPDATE_TYPES)

export const leadUpdateBodySchema = z
  .string()
  .trim()
  .min(1, 'Add a short description of the interaction.')
  .max(MAX_UPDATE_BODY_LENGTH, 'Keep updates under 10,000 characters.')

/**
 * An interaction cannot have happened in the future — that is always a typo,
 * and it would poison the cadence math the whole feature exists to produce.
 *
 * A small tolerance absorbs clock skew between the browser that stamped "now"
 * and the server that validates it.
 */
const FUTURE_TOLERANCE_MS = 60_000

export const occurredAtSchema = z
  .string()
  .datetime({ offset: true })
  .refine(
    value => new Date(value).getTime() <= Date.now() + FUTURE_TOLERANCE_MS,
    'An update can’t be dated in the future.'
  )

/**
 * Verify the lead exists and is not archived before writing anything to it.
 */
export async function findActiveLead(
  leadId: string
): Promise<{ id: string; contactName: string } | null> {
  const [lead] = await db
    .select({ id: leads.id, contactName: leads.contactName })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  return lead ?? null
}
