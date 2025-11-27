import type { leads } from '@/lib/db/schema'
import type { InferSelectModel } from 'drizzle-orm'
import type { LeadStatusValue } from './lead-constants'

/**
 * Lead record as selected from the database.
 */
export type Lead = InferSelectModel<typeof leads>

/**
 * Lead with the owner's information.
 */
export type LeadWithOwner = Lead & {
  owner: {
    id: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  } | null
}

/**
 * Payload for creating a new lead.
 */
export type CreateLeadPayload = {
  name: string
  status?: LeadStatusValue
  source?: string | null
  ownerId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  notes?: Record<string, unknown>
}

/**
 * Payload for updating an existing lead.
 */
export type UpdateLeadPayload = {
  id: string
  name?: string
  status?: LeadStatusValue
  source?: string | null
  ownerId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  notes?: Record<string, unknown>
}

/**
 * Result of a lead mutation (create/update/delete).
 */
export type LeadMutationResult = {
  error?: string
  leadId?: string
}

