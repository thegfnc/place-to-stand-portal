import 'server-only'

import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, hourBlocks } from '@/lib/db/schema'

import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'

export type HourBlockClientSummary = {
  id: string
  name: string
}

export type HourBlockSettingsSnapshot = {
  hourBlocks: HourBlockWithClient[]
  clients: ClientRow[]
}

type HourBlockSelection = {
  block: {
    id: string
    clientId: string
    hoursPurchased: string | null
    invoiceNumber: string | null
    createdBy: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
  }
  client: {
    id: string
    name: string
    deletedAt: string | null
  } | null
}

type ClientSelection = {
  id: string
  name: string
  deletedAt: string | null
}

const hourBlockSelection = {
  id: hourBlocks.id,
  clientId: hourBlocks.clientId,
  hoursPurchased: hourBlocks.hoursPurchased,
  invoiceNumber: hourBlocks.invoiceNumber,
  createdBy: hourBlocks.createdBy,
  createdAt: hourBlocks.createdAt,
  updatedAt: hourBlocks.updatedAt,
  deletedAt: hourBlocks.deletedAt,
} as const

const clientSelection = {
  id: clients.id,
  name: clients.name,
  deletedAt: clients.deletedAt,
} as const

export async function getHourBlocksSettingsSnapshot(
  user: AppUser,
): Promise<HourBlockSettingsSnapshot> {
  assertAdmin(user)

  const [hourBlockRows, clientRows] = await Promise.all([
    db
      .select({
        block: hourBlockSelection,
        client: clientSelection,
      })
      .from(hourBlocks)
      .leftJoin(clients, eq(hourBlocks.clientId, clients.id))
      .orderBy(desc(hourBlocks.updatedAt))
      .then(rows => rows as HourBlockSelection[]),
    db
      .select(clientSelection)
      .from(clients)
      .orderBy(asc(clients.name))
      .then(rows => rows as ClientSelection[]),
  ])

  return {
    hourBlocks: hourBlockRows.map(mapHourBlockWithClient),
    clients: clientRows.map(mapClientRow),
  }
}

export async function getActiveClientSummary(
  user: AppUser,
  clientId: string,
): Promise<HourBlockClientSummary | null> {
  assertAdmin(user)

  const rows = await db
    .select(clientSelection)
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1)

  if (!rows.length) {
    return null
  }

  return {
    id: rows[0]!.id,
    name: rows[0]!.name,
  }
}

export async function getHourBlockWithClientById(
  user: AppUser,
  hourBlockId: string,
): Promise<HourBlockWithClient | null> {
  assertAdmin(user)

  const rows = (await db
    .select({
      block: hourBlockSelection,
      client: clientSelection,
    })
    .from(hourBlocks)
    .leftJoin(clients, eq(hourBlocks.clientId, clients.id))
    .where(eq(hourBlocks.id, hourBlockId))
    .limit(1)) as HourBlockSelection[]

  if (!rows.length) {
    return null
  }

  return mapHourBlockWithClient(rows[0]!)
}

function mapHourBlockWithClient(row: HourBlockSelection): HourBlockWithClient {
  const client = row.client && row.client.id
    ? {
        id: row.client.id,
        name: row.client.name,
        deleted_at: row.client.deletedAt,
      }
    : null

  return {
    id: row.block.id,
    client_id: row.block.clientId,
    hours_purchased: Number(row.block.hoursPurchased ?? '0'),
    invoice_number: row.block.invoiceNumber,
    created_by: row.block.createdBy,
    created_at: row.block.createdAt,
    updated_at: row.block.updatedAt,
    deleted_at: row.block.deletedAt,
    client,
  }
}

function mapClientRow(row: ClientSelection): ClientRow {
  return {
    id: row.id,
    name: row.name,
    deleted_at: row.deletedAt,
  }
}
