import type { LeadSourceTypeValue, LeadStatusValue } from './constants'
import type { LeadUpdateTypeValue } from './updates'

// =============================================================================
// Database Types
// =============================================================================
// =============================================================================
// Mutation Types
// =============================================================================
// =============================================================================
// Presentation Types
// =============================================================================

/**
 * Enriched lead record for UI display.
 * Includes computed/joined fields like assignee info and formatted notes.
 */
export type LeadRecord = {
  id: string
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  assigneeName: string | null
  assigneeEmail: string | null
  assigneeAvatarUrl: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notesHtml: string
  rank: string
  createdAt: string
  updatedAt: string

  // Activity Tracking
  lastContactAt: string | null
  awaitingReply: boolean

  // Predictions
  expectedCloseDate: string | null

  // Conversion
  convertedAt: string | null
  convertedToClientId: string | null
}

/**
 * What a converted lead became, for the lead sheet's sidebar. See
 * `fetchLeadConversionSummary` for how the contact and projects are resolved.
 */
export type LeadConversionSummary = {
  client: { id: string; name: string; slug: string | null; archived: boolean }
  contact: { id: string; name: string; email: string } | null
  projects: Array<{
    id: string
    name: string
    slug: string | null
    status: string
  }>
}

export type LeadBoardColumnData = {
  id: LeadStatusValue
  label: string
  description: string
  leads: LeadRecord[]
}

export type LeadAssigneeOption = {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
  /** Set when the admin can no longer sign in; shown only on leads they already hold. */
  disabledAt: string | null
}

/**
 * A single logged interaction on a lead, hydrated for the timeline.
 *
 * Author identity is denormalized the same way `LeadRecord` flattens the
 * assignee fields — it keeps the timeline from needing a round trip per row.
 */
export type LeadUpdateRecord = {
  id: string
  leadId: string
  type: LeadUpdateTypeValue
  body: string
  occurredAt: string
  authorId: string
  authorName: string | null
  authorEmail: string | null
  authorAvatarUrl: string | null
  createdAt: string
  updatedAt: string
}
