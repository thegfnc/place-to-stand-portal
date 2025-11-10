import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, hourBlocks } from '@/lib/db/schema'

import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'

import {
  clampLimit,
  createSearchPattern,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'

export type HourBlockClientSummary = {
  id: string
  name: string
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

export type ListHourBlocksForSettingsInput = {
  status?: 'active' | 'archived'
  search?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

export type HourBlocksSettingsResult = {
  items: HourBlockWithClient[]
  clients: ClientRow[]
  totalCount: number
  pageInfo: PageInfo
}

function buildHourBlocksCursorCondition(
  direction: CursorDirection,
  cursor: { updatedAt?: string | null; id?: string | null } | null,
) {
  if (!cursor) {
    return null
  }

  const updatedAt = cursor.updatedAt ?? null
  const idValue = typeof cursor.id === 'string' ? cursor.id : ''

  if (!updatedAt || !idValue) {
    return null
  }

  if (direction === 'forward') {
    return sql`${hourBlocks.updatedAt} < ${updatedAt} OR (${hourBlocks.updatedAt} = ${updatedAt} AND ${hourBlocks.id} < ${idValue})`
  }

  return sql`${hourBlocks.updatedAt} > ${updatedAt} OR (${hourBlocks.updatedAt} = ${updatedAt} AND ${hourBlocks.id} > ${idValue})`
}

export async function listHourBlocksForSettings(
  user: AppUser,
  input: ListHourBlocksForSettingsInput = {},
): Promise<HourBlocksSettingsResult> {
  assertAdmin(user)

  const direction = resolveDirection(input.direction)
  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const searchQuery = input.search?.trim() ?? ''

  const baseConditions: SQL[] = []

  if (normalizedStatus === 'active') {
    baseConditions.push(isNull(hourBlocks.deletedAt))
  } else {
    baseConditions.push(sql`${hourBlocks.deletedAt} IS NOT NULL`)
  }

  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${hourBlocks.invoiceNumber} ILIKE ${pattern} OR ${clients.name} ILIKE ${pattern})`,
    )
  }

  const cursorPayload = decodeCursor<{ updatedAt?: string; id?: string }>(
    input.cursor,
  )
  const cursorCondition = buildHourBlocksCursorCondition(
    direction,
    cursorPayload,
  )

  const paginatedConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions

  const whereClause =
    paginatedConditions.length > 0 ? and(...paginatedConditions) : undefined

  const ordering =
    direction === 'forward'
      ? [desc(hourBlocks.updatedAt), desc(hourBlocks.id)]
      : [asc(hourBlocks.updatedAt), asc(hourBlocks.id)]

  const rows = (await db
    .select({
      block: hourBlockSelection,
      client: clientSelection,
    })
    .from(hourBlocks)
    .leftJoin(clients, eq(hourBlocks.clientId, clients.id))
    .where(whereClause)
    .orderBy(...ordering)
    .limit(limit + 1)) as HourBlockSelection[]

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const hourBlocksList = normalizedRows.map(mapHourBlockWithClient)

  const [totalResult, clientDirectory] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(hourBlocks)
      .where(
        baseConditions.length ? and(...baseConditions) : undefined,
      ),
    db
      .select(clientSelection)
      .from(clients)
      .orderBy(asc(clients.name)),
  ])

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const firstItem = hourBlocksList[0] ?? null
  const lastItem = hourBlocksList[hourBlocksList.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward' ? Boolean(cursorPayload) : hasExtraRecord
  const hasNextPage =
    direction === 'forward' ? hasExtraRecord : Boolean(cursorPayload)

  const pageInfo: PageInfo = {
    hasPreviousPage,
    hasNextPage,
    startCursor: firstItem
      ? encodeCursor({
          updatedAt: firstItem.updated_at,
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeCursor({
          updatedAt: lastItem.updated_at,
          id: lastItem.id,
        })
      : null,
  }

  return {
    items: hourBlocksList,
    clients: clientDirectory.map(mapClientRow),
    totalCount,
    pageInfo,
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
