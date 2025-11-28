import type { leads } from '@/lib/db/schema'
import type { InferSelectModel } from 'drizzle-orm'
import type { LeadStatusValue } from './lead-constants'
import type { LeadSourceTypeValue } from './constants'

/**
 * Lead record as selected from the database.
 */
export type Lead = InferSelectModel<typeof leads>

/**
 * Lead with the owner's information.
 */
export type LeadWithAssignee = Lead & {
  assignee: {
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
  contactName: string
  status?: LeadStatusValue
  sourceType?: LeadSourceTypeValue | null
  sourceDetail?: string | null
  assigneeId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  companyName?: string | null
  companyWebsite?: string | null
  notes?: Record<string, unknown>
}

/**
 * Payload for updating an existing lead.
 */
export type UpdateLeadPayload = {
  id: string
  contactName?: string
  status?: LeadStatusValue
  sourceType?: LeadSourceTypeValue | null
  sourceDetail?: string | null
  assigneeId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  companyName?: string | null
  companyWebsite?: string | null
  notes?: Record<string, unknown>
}

/**
 * Result of a lead mutation (create/update/delete).
 */
export type LeadMutationResult = {
  error?: string
  leadId?: string
}
