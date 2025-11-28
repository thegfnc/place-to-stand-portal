import 'server-only'

import { cache } from 'react'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
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
  async (_user: AppUser): Promise<LeadBoardColumnData[]> => {
    void _user
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
        contactEmail: row.contactEmail ?? null,
        contactPhone: row.contactPhone ?? null,
        companyName: row.companyName ?? null,
        companyWebsite: row.companyWebsite ?? null,
        notesHtml: extractLeadNotes(row.notes),
        rank: row.rank,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    })

    return LEAD_BOARD_COLUMNS.map(column => ({
      ...column,
      leads: columnMap.get(column.id) ?? [],
    }))
  }
)

export const fetchLeadById = cache(
  async (_user: AppUser, leadId: string): Promise<LeadRecord> => {
    void _user
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
    contactEmail: lead.contactEmail ?? null,
    contactPhone: lead.contactPhone ?? null,
    companyName: lead.companyName ?? null,
    companyWebsite: lead.companyWebsite ?? null,
    notesHtml: extractLeadNotes(lead.notes),
    rank: lead.rank,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    }
  }
)

export const fetchLeadAssignees = cache(async (): Promise<LeadAssigneeOption[]> => {
  const admins = await fetchAdminUsers()

  return admins.map(admin => ({
    id: admin.id,
    name: admin.full_name ?? admin.email,
    email: admin.email,
  }))
})

async function selectLeadRows({
  includeRank,
  where,
}: {
  includeRank: boolean
  where?: ReturnType<typeof eq>
}) {
  const selection = {
    id: leads.id,
    contactName: leads.contactName,
    status: leads.status,
    sourceType: leads.sourceType,
    sourceDetail: leads.sourceDetail,
    assigneeId: leads.assigneeId,
    assigneeName: users.fullName,
    assigneeEmail: users.email,
    contactEmail: leads.contactEmail,
    contactPhone: leads.contactPhone,
    companyName: leads.companyName,
    companyWebsite: leads.companyWebsite,
    notes: leads.notes,
    rank: includeRank ? leads.rank : sql<string>`'zzzzzzzz'`,
    createdAt: leads.createdAt,
    updatedAt: leads.updatedAt,
  }

  return db
    .select(selection)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(
      where ? and(where, isNull(leads.deletedAt)) : isNull(leads.deletedAt)
    )
    .orderBy(
      asc(leads.status),
      includeRank ? asc(leads.rank) : asc(leads.createdAt)
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
