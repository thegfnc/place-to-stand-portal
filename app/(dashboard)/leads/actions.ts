'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import {
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_VALUES,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { serializeLeadNotes } from '@/lib/leads/notes'
import { resolveNextLeadRank } from '@/lib/leads/rank'
import { normalizeRank } from '@/lib/rank'

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

const moveLeadSchema = z.object({
  leadId: z.string().uuid(),
  targetStatus: z.enum(LEAD_STATUS_VALUES),
  rank: z.string().min(1, 'Rank is required'),
})

const archiveLeadSchema = z.object({
  leadId: z.string().uuid(),
})

export type SaveLeadInput = z.infer<typeof saveLeadSchema>
export type MoveLeadInput = z.infer<typeof moveLeadSchema>
export type ArchiveLeadInput = z.infer<typeof archiveLeadSchema>

export type LeadActionResult = {
  success: boolean
  error?: string
}

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

  try {
    if (!normalized.id) {
      const rank = await resolveNextLeadRank(normalized.status)

      await db.insert(leads).values({
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
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    } else {
      const existingRows = await db
        .select({
          id: leads.id,
          status: leads.status,
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

      if (existing.status !== normalized.status) {
        rank = await resolveNextLeadRank(normalized.status)
      }

      await db
        .update(leads)
        .set({
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
        })
        .where(eq(leads.id, normalized.id))
    }
  } catch (error) {
    console.error('Failed to save lead', error)
    return {
      success: false,
      error: 'Unable to save lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}

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
    const updated = await db
      .update(leads)
      .set({
        status: parsed.data.targetStatus,
        rank: normalizedRank,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(leads.id, parsed.data.leadId), isNull(leads.deletedAt)))
      .returning({ id: leads.id })

    if (!updated.length) {
      return { success: false, error: 'Lead not found.' }
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

export async function archiveLead(
  input: ArchiveLeadInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = archiveLeadSchema.safeParse(input)

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
        deletedAt: new Date().toISOString(),
      })
      .where(and(eq(leads.id, parsed.data.leadId), isNull(leads.deletedAt)))
      .returning({ id: leads.id })

    if (!result.length) {
      return { success: false, error: 'Lead not found.' }
    }
  } catch (error) {
    console.error('Failed to archive lead', error)
    return {
      success: false,
      error: 'Unable to archive lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
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

function revalidateLeadsPath() {
  revalidatePath('/leads/board')
}

