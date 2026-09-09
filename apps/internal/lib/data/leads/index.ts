import 'server-only'

import { cache } from 'react'
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { extractLeadNotes } from '@/lib/leads/notes'
import {
  LEAD_BOARD_COLUMNS,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import type {
  LeadAssigneeOption,
  LeadBoardColumnData,
  LeadRecord,
} from '@/lib/leads/types'
import { fetchAdminUsers } from '@/lib/data/users'

export const fetchLeadsBoard = cache(
  async (user: AppUser): Promise<LeadBoardColumnData[]> => {
    // Leads are admin-only - enforce at data layer for defense in depth
    assertAdmin(user)
    let rows: LeadRow[]

    try {
      rows = await selectLeadRows({ includeRank: true })
    } catch (error) {
      if (isMissingRankColumnError(error)) {
        console.warn(
          '[fetchLeadsBoard] Missing leads.rank column, falling back to createdAt ordering.'
        )
        rows = await selectLeadRows({ includeRank: false })
      } else {
        throw error
      }
    }

    const columnMap = new Map<LeadStatusValue, LeadRecord[]>(
      LEAD_BOARD_COLUMNS.map(column => [column.id, []])
    )

    rows.forEach(row => {
      const bucket = columnMap.get(row.status as LeadStatusValue)
      if (!bucket) {
        return
      }

      bucket.push({
        id: row.id,
        contactName: row.contactName,
        status: row.status as LeadStatusValue,
        sourceType: (row.sourceType as LeadRecord['sourceType']) ?? null,
        sourceDetail: row.sourceDetail ?? null,
        assigneeId: row.assigneeId ?? null,
        assigneeName: row.assigneeName ?? null,
        assigneeEmail: row.assigneeEmail ?? null,
        assigneeAvatarUrl: row.assigneeAvatarUrl ?? null,
        contactEmail: row.contactEmail ?? null,
        contactPhone: row.contactPhone ?? null,
        companyName: row.companyName ?? null,
        companyWebsite: row.companyWebsite ?? null,
        notesHtml: extractLeadNotes(row.notes),
        rank: row.rank,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // Activity Tracking
        lastContactAt: row.lastContactAt ?? null,
        awaitingReply: row.awaitingReply ?? false,
        // Predictions
        expectedCloseDate: row.expectedCloseDate ?? null,
        // Conversion
        convertedAt: row.convertedAt ?? null,
        convertedToClientId: row.convertedToClientId ?? null,
      })
    })

    return LEAD_BOARD_COLUMNS.map(column => ({
      ...column,
      leads: columnMap.get(column.id) ?? [],
    }))
  }
)

export const fetchLeadById = cache(
  async (user: AppUser, leadId: string): Promise<LeadRecord> => {
    // Leads are admin-only - enforce at data layer for defense in depth
    assertAdmin(user)
    let rows: LeadRow[]

    try {
      rows = await selectLeadRows({
        includeRank: true,
        where: eq(leads.id, leadId),
      })
    } catch (error) {
      if (isMissingRankColumnError(error)) {
        rows = await selectLeadRows({
          includeRank: false,
          where: eq(leads.id, leadId),
        })
      } else {
        throw error
      }
    }

    if (!rows.length) {
      throw new NotFoundError('Lead not found')
    }

    const lead = rows[0]

    return {
      id: lead.id,
      contactName: lead.contactName,
      status: lead.status as LeadStatusValue,
      sourceType: (lead.sourceType as LeadRecord['sourceType']) ?? null,
      sourceDetail: lead.sourceDetail ?? null,
      assigneeId: lead.assigneeId ?? null,
      assigneeName: lead.assigneeName ?? null,
      assigneeEmail: lead.assigneeEmail ?? null,
      assigneeAvatarUrl: lead.assigneeAvatarUrl ?? null,
      contactEmail: lead.contactEmail ?? null,
      contactPhone: lead.contactPhone ?? null,
      companyName: lead.companyName ?? null,
      companyWebsite: lead.companyWebsite ?? null,
      notesHtml: extractLeadNotes(lead.notes),
      rank: lead.rank,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      // Activity Tracking
      lastContactAt: lead.lastContactAt ?? null,
      awaitingReply: lead.awaitingReply ?? false,
      // Predictions
      expectedCloseDate: lead.expectedCloseDate ?? null,
      // Conversion
      convertedAt: lead.convertedAt ?? null,
      convertedToClientId: lead.convertedToClientId ?? null,
    }
  }
)

/**
 * Full lead record so the archive view can open leads in the LeadSheet,
 * plus the archive timestamp the table sorts/displays by.
 */
export type ArchivedLead = LeadRecord & { deletedAt: string }

export const fetchArchivedLeads = cache(
  async (user: AppUser): Promise<ArchivedLead[]> => {
    assertAdmin(user)
    let rows: LeadRow[]

    try {
      rows = await selectLeadRows({ includeRank: true, archived: true })
    } catch (error) {
      if (isMissingRankColumnError(error)) {
        rows = await selectLeadRows({ includeRank: false, archived: true })
      } else {
        throw error
      }
    }

    return rows.map(row => ({
      id: row.id,
      contactName: row.contactName,
      status: row.status as LeadStatusValue,
      sourceType: (row.sourceType as LeadRecord['sourceType']) ?? null,
      sourceDetail: row.sourceDetail ?? null,
      assigneeId: row.assigneeId ?? null,
      assigneeName: row.assigneeName ?? null,
      assigneeEmail: row.assigneeEmail ?? null,
      assigneeAvatarUrl: row.assigneeAvatarUrl ?? null,
      contactEmail: row.contactEmail ?? null,
      contactPhone: row.contactPhone ?? null,
      companyName: row.companyName ?? null,
      companyWebsite: row.companyWebsite ?? null,
      notesHtml: extractLeadNotes(row.notes),
      rank: row.rank,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Activity Tracking
      lastContactAt: row.lastContactAt ?? null,
      awaitingReply: row.awaitingReply ?? false,
      // Predictions
      expectedCloseDate: row.expectedCloseDate ?? null,
      // Conversion
      convertedAt: row.convertedAt ?? null,
      convertedToClientId: row.convertedToClientId ?? null,
      deletedAt: row.deletedAt!,
    }))
  }
)

export const fetchLeadAssignees = cache(async (): Promise<LeadAssigneeOption[]> => {
  const admins = await fetchAdminUsers()

  return admins.map(admin => ({
    id: admin.id,
    name: admin.full_name ?? admin.email,
    email: admin.email,
    avatarUrl: admin.avatar_url,
    disabledAt: admin.disabled_at ?? null,
  }))
})

async function selectLeadRows({
  includeRank,
  where,
  archived = false,
}: {
  includeRank: boolean
  where?: ReturnType<typeof eq>
  archived?: boolean
}) {
  const selection = {
    deletedAt: leads.deletedAt,
    id: leads.id,
    contactName: leads.contactName,
    status: leads.status,
    sourceType: leads.sourceType,
    sourceDetail: leads.sourceDetail,
    assigneeId: leads.assigneeId,
    assigneeName: users.fullName,
    assigneeEmail: users.email,
    assigneeAvatarUrl: users.avatarUrl,
    contactEmail: leads.contactEmail,
    contactPhone: leads.contactPhone,
    companyName: leads.companyName,
    companyWebsite: leads.companyWebsite,
    notes: leads.notes,
    rank: includeRank ? leads.rank : sql<string>`'zzzzzzzz'`,
    createdAt: leads.createdAt,
    updatedAt: leads.updatedAt,
    // Activity Tracking
    lastContactAt: leads.lastContactAt,
    awaitingReply: leads.awaitingReply,
    // Predictions
    expectedCloseDate: leads.expectedCloseDate,
    // Conversion
    convertedAt: leads.convertedAt,
    convertedToClientId: leads.convertedToClientId,
  }

  const deletedFilter = archived
    ? isNotNull(leads.deletedAt)
    : isNull(leads.deletedAt)

  return db
    .select(selection)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(where ? and(where, deletedFilter) : deletedFilter)
    .orderBy(
      ...(archived
        ? [desc(leads.deletedAt)]
        : [
            asc(leads.status),
            includeRank ? asc(leads.rank) : asc(leads.createdAt),
          ])
    )
}

function isMissingRankColumnError(error: unknown) {
  return (
    error instanceof Error &&
    /column\b.+\bleads\.rank\b.+does not exist/i.test(error.message)
  )
}

type LeadRowPromise = ReturnType<typeof selectLeadRows>
type LeadRow = LeadRowPromise extends Promise<Array<infer T>> ? T : never
