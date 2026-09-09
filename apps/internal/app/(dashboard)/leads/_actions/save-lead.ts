'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import {
  leadCreatedEvent,
  leadStatusChangedEvent,
  leadUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, leadStageHistory } from '@/lib/db/schema'
import {
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_VALUES,
  isTerminalLeadStatus,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { extractLeadNotes, serializeLeadNotes } from '@/lib/leads/notes'
import { resolveNextLeadRank } from '@/lib/leads/rank'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const saveLeadSchema = z.object({
  id: z.string().uuid().optional(),
  contactName: z
    .string()
    .trim()
    .min(1, 'Contact name is required')
    .max(160),
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  sourceType: z.enum(LEAD_SOURCE_TYPES).optional().nullable(),
  sourceDetail: z
    .string()
    .trim()
    .max(160, 'Source info must be 160 characters or fewer')
    .optional()
    .nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  contactEmail: z.string().trim().max(160).optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  companyWebsite: z.string().trim().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type SaveLeadInput = z.infer<typeof saveLeadSchema>

export async function saveLead(input: SaveLeadInput): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = saveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid lead payload.',
    }
  }

  let normalized: ReturnType<typeof normalizeLeadPayload>

  try {
    normalized = normalizeLeadPayload(parsed.data)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid lead payload.',
    }
  }
  const timestamp = new Date().toISOString()

  let createdLeadId: string | undefined

  try {
    if (!normalized.id) {
      const rank = await resolveNextLeadRank(normalized.status)

      const inserted = await db.insert(leads).values({
        contactName: normalized.contactName,
        status: normalized.status,
        sourceType: normalized.sourceType,
        sourceDetail: normalized.sourceDetail,
        assigneeId: normalized.assigneeId,
        contactEmail: normalized.contactEmail,
        contactPhone: normalized.contactPhone,
        companyName: normalized.companyName,
        companyWebsite: normalized.companyWebsite,
        notes: serializeLeadNotes(normalized.notes),
        rank,
        currentStageEnteredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).returning({ id: leads.id })

      createdLeadId = inserted[0]?.id
      if (createdLeadId) {
        await db.insert(leadStageHistory).values({
          leadId: createdLeadId,
          fromStatus: null,
          toStatus: normalized.status,
          changedAt: timestamp,
          changedBy: user.id,
        })

        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          targetType: 'LEAD',
          targetId: createdLeadId,
          ...leadCreatedEvent({
            name: normalized.contactName,
            source: normalized.sourceType,
            status: normalized.status,
          }),
        })
      }
    } else {
      const existingRows = await db
        .select({
          id: leads.id,
          contactName: leads.contactName,
          status: leads.status,
          sourceType: leads.sourceType,
          sourceDetail: leads.sourceDetail,
          assigneeId: leads.assigneeId,
          contactEmail: leads.contactEmail,
          contactPhone: leads.contactPhone,
          companyName: leads.companyName,
          companyWebsite: leads.companyWebsite,
          notes: leads.notes,
          rank: leads.rank,
        })
        .from(leads)
        .where(and(eq(leads.id, normalized.id), isNull(leads.deletedAt)))
        .limit(1)

      const existing = existingRows[0]

      if (!existing) {
        return { success: false, error: 'Lead not found.' }
      }

      let rank = existing.rank
      const statusChanged = existing.status !== normalized.status
      const diff = diffLeadFields(existing, normalized)

      if (statusChanged) {
        rank = await resolveNextLeadRank(normalized.status)
      }

      const setPayload: Record<string, unknown> = {
        contactName: normalized.contactName,
        status: normalized.status,
        sourceType: normalized.sourceType,
        sourceDetail: normalized.sourceDetail,
        assigneeId: normalized.assigneeId,
        contactEmail: normalized.contactEmail,
        contactPhone: normalized.contactPhone,
        companyName: normalized.companyName,
        companyWebsite: normalized.companyWebsite,
        notes: serializeLeadNotes(normalized.notes),
        rank,
        updatedAt: timestamp,
      }

      if (statusChanged) {
        setPayload.currentStageEnteredAt = timestamp

        if (isTerminalLeadStatus(normalized.status)) {
          setPayload.resolvedAt = timestamp
        }

        // Reset conversion/resolution fields when moving back to an active stage
        if (isTerminalLeadStatus(existing.status) && !isTerminalLeadStatus(normalized.status)) {
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
        .where(eq(leads.id, normalized.id))

      if (statusChanged) {
        await db.insert(leadStageHistory).values({
          leadId: normalized.id,
          fromStatus: existing.status,
          toStatus: normalized.status,
          changedAt: timestamp,
          changedBy: user.id,
        })
      }

      // Status-only edits read as a stage move; anything else is a field diff
      // that carries status inside it when both changed. A no-op save logs
      // nothing.
      if (diff.changedFields.length === 1 && statusChanged) {
        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          targetType: 'LEAD',
          targetId: normalized.id,
          ...leadStatusChangedEvent({
            name: normalized.contactName,
            fromStatus: existing.status,
            toStatus: normalized.status,
          }),
        })
      } else if (diff.changedFields.length > 0) {
        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          targetType: 'LEAD',
          targetId: normalized.id,
          ...leadUpdatedEvent({
            name: normalized.contactName,
            changedFields: diff.changedFields,
            details: { before: diff.before, after: diff.after },
          }),
        })
      }
    }
  } catch (error) {
    console.error('Failed to save lead', error)
    return {
      success: false,
      error: 'Unable to save lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true, leadId: createdLeadId }
}

type NormalizedLead = ReturnType<typeof normalizeLeadPayload>

type ExistingLead = {
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notes: unknown
}

/**
 * Field-by-field comparison of the editable lead columns. Labels in
 * `changedFields` are the human phrases the summary joins; the `before`/`after`
 * records keep raw column values (enums and ids unresolved) for the feed.
 */
function diffLeadFields(
  existing: ExistingLead,
  next: NormalizedLead
): {
  changedFields: string[]
  before: Record<string, unknown>
  after: Record<string, unknown>
} {
  const changedFields: string[] = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  const compare = (
    label: string,
    key: keyof ExistingLead,
    previous: unknown,
    current: unknown
  ) => {
    if (previous === current) {
      return
    }
    changedFields.push(label)
    before[key] = previous
    after[key] = current
  }

  compare('name', 'contactName', existing.contactName, next.contactName)
  compare('status', 'status', existing.status, next.status)
  compare('source', 'sourceType', existing.sourceType, next.sourceType)
  compare('source detail', 'sourceDetail', existing.sourceDetail, next.sourceDetail)
  compare('assignee', 'assigneeId', existing.assigneeId, next.assigneeId)
  compare('email', 'contactEmail', existing.contactEmail, next.contactEmail)
  compare('phone', 'contactPhone', existing.contactPhone, next.contactPhone)
  compare('company', 'companyName', existing.companyName, next.companyName)
  compare('website', 'companyWebsite', existing.companyWebsite, next.companyWebsite)
  compare(
    'notes',
    'notes',
    extractLeadNotes(existing.notes) || null,
    next.notes
  )

  return { changedFields, before, after }
}

function normalizeLeadPayload(
  payload: SaveLeadInput
): {
  id?: string
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notes: string | null
} {
  return {
    id: payload.id,
    contactName: payload.contactName.trim(),
    status: payload.status ?? 'NEW_OPPORTUNITIES',
    sourceType: payload.sourceType ?? null,
    sourceDetail: normalizeOptionalString(payload.sourceDetail, 160),
    assigneeId: payload.assigneeId ?? null,
    contactEmail: normalizeEmail(payload.contactEmail),
    contactPhone: normalizeOptionalString(payload.contactPhone, 40),
    companyName: normalizeOptionalString(payload.companyName, 160),
    companyWebsite: normalizeOptionalString(payload.companyWebsite, 255),
    notes: (payload.notes ?? '').trim() || null,
  }
}

function normalizeOptionalString(
  value: string | null | undefined,
  maxLength: number
): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed.length) {
    return null
  }

  const truncated = trimmed.slice(0, maxLength)
  return truncated
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed.length) {
    return null
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailPattern.test(trimmed)) {
    throw new Error('Invalid email address.')
  }

  return trimmed
}
