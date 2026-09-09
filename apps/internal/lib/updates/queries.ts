import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientUpdates } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import {
  normalizeClientUpdateRow,
  type ClientUpdateItem,
  type ClientUpdateRecipients,
  type ClientUpdateRow,
  type ClientUpdateStatus,
} from './types'

type CreateClientUpdateInput = {
  clientId: string
  subject: string
  intro: string
  items: ClientUpdateItem[]
  closing: string
  periodStart: string
  periodEnd: string
  recipients: ClientUpdateRecipients
  createdById: string
}

export async function createClientUpdate(
  input: CreateClientUpdateInput
): Promise<ClientUpdateRow> {
  const [row] = await db.insert(clientUpdates).values(input).returning()
  return normalizeClientUpdateRow(row)
}

export async function fetchClientUpdate(id: string): Promise<ClientUpdateRow> {
  const [row] = await db
    .select()
    .from(clientUpdates)
    .where(and(eq(clientUpdates.id, id), isNull(clientUpdates.deletedAt)))
    .limit(1)

  if (!row) throw new NotFoundError('Update not found')
  return normalizeClientUpdateRow(row)
}

type ListClientUpdatesOptions = {
  clientId?: string
  status?: ClientUpdateStatus
  limit?: number
}

export async function listClientUpdates(
  options: ListClientUpdatesOptions = {}
): Promise<ClientUpdateRow[]> {
  const conditions = [isNull(clientUpdates.deletedAt)]
  if (options.clientId)
    conditions.push(eq(clientUpdates.clientId, options.clientId))
  if (options.status) conditions.push(eq(clientUpdates.status, options.status))

  const rows = await db
    .select()
    .from(clientUpdates)
    .where(and(...conditions))
    .orderBy(desc(clientUpdates.createdAt))
    .limit(options.limit ?? 50)

  return rows.map(normalizeClientUpdateRow)
}

type UpdateDraftInput = {
  subject: string
  intro: string
  items: ClientUpdateItem[]
  closing: string
  recipients: ClientUpdateRecipients
}

export async function updateClientUpdateDraft(
  id: string,
  input: UpdateDraftInput
): Promise<ClientUpdateRow> {
  const [row] = await db
    .update(clientUpdates)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(clientUpdates.id, id),
        eq(clientUpdates.status, 'DRAFT'),
        isNull(clientUpdates.deletedAt)
      )
    )
    .returning()

  if (!row) throw new NotFoundError('Draft not found')
  return normalizeClientUpdateRow(row)
}

type MarkSentInput = {
  sentById: string
  gmailMessageId: string
  gmailThreadId: string
}

export async function markClientUpdateSent(
  id: string,
  input: MarkSentInput
): Promise<ClientUpdateRow> {
  const now = new Date().toISOString()
  const [row] = await db
    .update(clientUpdates)
    .set({ ...input, status: 'SENT', sentAt: now, updatedAt: now })
    .where(eq(clientUpdates.id, id))
    .returning()

  if (!row) throw new NotFoundError('Update not found')
  return normalizeClientUpdateRow(row)
}

/** `period_end` of the most recently sent update for a client, if any. */
export async function fetchLastSentPeriodEnd(
  clientId: string
): Promise<string | null> {
  const [row] = await db
    .select({ periodEnd: clientUpdates.periodEnd })
    .from(clientUpdates)
    .where(
      and(
        eq(clientUpdates.clientId, clientId),
        eq(clientUpdates.status, 'SENT'),
        isNull(clientUpdates.deletedAt)
      )
    )
    .orderBy(desc(clientUpdates.sentAt))
    .limit(1)

  return row?.periodEnd ?? null
}
