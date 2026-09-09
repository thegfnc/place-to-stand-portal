import 'server-only'

import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, hourBlocks, invoices } from '@/lib/db/schema'
import { PAGE_SIZE_LIMITS } from '@/lib/pagination/page-size'

import type {
  ClientRow,
  HourBlockInvoiceRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'

import {
  clampLimit,
  createSearchPattern,
  resolveDirection,
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'
import {
  decodeSortCursor,
  encodeSortCursor,
  type ParsedSort,
} from '@/lib/pagination/sort'
import {
  DEFAULT_HOUR_BLOCKS_SORT,
  type HourBlockSortField,
} from '@/lib/settings/hour-blocks/filters'

export type HourBlockClientSummary = {
  id: string
  name: string
}

type HourBlockSelection = {
  block: {
    id: string
    clientId: string
    hoursPurchased: string | null
    invoiceId: string | null
    invoiceNumber: string | null
    notes: string | null
    createdBy: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    billingMonth: string
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

// invoiceNumber is derived from the linked invoice — every query using this
// selection must leftJoin(invoices, eq(hourBlocks.invoiceId, invoices.id)).
const hourBlockSelection = {
  id: hourBlocks.id,
  clientId: hourBlocks.clientId,
  hoursPurchased: hourBlocks.hoursPurchased,
  invoiceId: hourBlocks.invoiceId,
  invoiceNumber: invoices.invoiceNumber,
  notes: hourBlocks.notes,
  createdBy: hourBlocks.createdBy,
  createdAt: hourBlocks.createdAt,
  updatedAt: hourBlocks.updatedAt,
  deletedAt: hourBlocks.deletedAt,
  billingMonth: hourBlocks.billingMonth,
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
  offset?: number | null
  sort?: ParsedSort<HourBlockSortField>
}

export type HourBlocksSettingsResult = {
  items: HourBlockWithClient[]
  clients: ClientRow[]
  /** Rows matching the active filters/search (drives `Showing N of M`). */
  totalCount: number
  /** Rows on the tab regardless of filters/search (the `M`). */
  unfilteredTotalCount: number
  pageInfo: PageInfo
}

/**
 * Per-sort descriptor (PRD 004 §03, R5): order expression + field-tagged
 * cursor value encoding + comparison predicates. `createdAt` is
 * non-nullable so no null partition applies.
 */
type HourBlockSortDescriptor = {
  encode: (row: HourBlockWithClient) => string
  compare: (op: 'gt' | 'lt', value: string) => SQL
  equals: (value: string) => SQL
  orderAsc: SQL
  orderDesc: SQL
}

const HOUR_BLOCK_SORT_DESCRIPTORS: Record<
  HourBlockSortField,
  HourBlockSortDescriptor
> = {
  created: {
    encode: row => String(row.created_at),
    compare: (op, value) =>
      op === 'gt'
        ? sql`${hourBlocks.createdAt} > ${value}::timestamptz`
        : sql`${hourBlocks.createdAt} < ${value}::timestamptz`,
    equals: value => sql`${hourBlocks.createdAt} = ${value}::timestamptz`,
    orderAsc: sql`${hourBlocks.createdAt} ASC`,
    orderDesc: sql`${hourBlocks.createdAt} DESC`,
  },
}

export async function listHourBlocksForSettings(
  user: AppUser,
  input: ListHourBlocksForSettingsInput = {}
): Promise<HourBlocksSettingsResult> {
  assertAdmin(user)

  const direction = resolveDirection(input.direction)
  const limit = clampLimit(input.limit, PAGE_SIZE_LIMITS)
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const searchQuery = input.search?.trim() ?? ''
  const sort = input.sort ?? DEFAULT_HOUR_BLOCKS_SORT
  const descriptor = HOUR_BLOCK_SORT_DESCRIPTORS[sort.field]

  const statusCondition =
    normalizedStatus === 'active'
      ? isNull(hourBlocks.deletedAt)
      : sql`${hourBlocks.deletedAt} IS NOT NULL`

  // Filters/search live in baseConditions so totalCount follows them; the
  // unfiltered count only applies the tab condition.
  const baseConditions: SQL[] = [statusCondition]

  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${invoices.invoiceNumber} ILIKE ${pattern} OR ${clients.name} ILIKE ${pattern})`
    )
  }

  const useOffset = typeof input.offset === 'number' && input.offset >= 0

  let hourBlocksList: HourBlockWithClient[]
  let hasExtraRecord = false
  let cursorPayloadPresent = false

  if (useOffset) {
    const baseWhere = and(...baseConditions)

    const ordering =
      sort.direction === 'asc'
        ? [descriptor.orderAsc, asc(hourBlocks.id)]
        : [descriptor.orderDesc, sql`${hourBlocks.id} DESC`]

    const rows = (await db
      .select({
        block: hourBlockSelection,
        client: clientSelection,
      })
      .from(hourBlocks)
      .leftJoin(clients, eq(hourBlocks.clientId, clients.id))
      .leftJoin(invoices, eq(hourBlocks.invoiceId, invoices.id))
      .where(baseWhere)
      .orderBy(...ordering)
      .limit(limit)
      .offset(input.offset!)) as HourBlockSelection[]

    hourBlocksList = rows.map(mapHourBlockWithClient)
  } else {
    // Field-tagged cursor: payloads minted under a different sort are
    // rejected and we serve page one (R5 backstop for stale deep links).
    const cursorPayload = decodeSortCursor(
      input.cursor,
      sort.field,
      sort.direction
    )
    cursorPayloadPresent = Boolean(cursorPayload)

    // Effective ordering combines the sort direction with the pagination
    // direction (backward pages scan the reversed order, then re-reverse).
    const effectiveAsc = (sort.direction === 'asc') === (direction === 'forward')
    const cursorCondition = cursorPayload
      ? sql`(${descriptor.compare(effectiveAsc ? 'gt' : 'lt', cursorPayload.value ?? '')} OR (${descriptor.equals(cursorPayload.value ?? '')} AND ${effectiveAsc ? sql`${hourBlocks.id} > ${cursorPayload.id}` : sql`${hourBlocks.id} < ${cursorPayload.id}`}))`
      : null

    const paginatedConditions = cursorCondition
      ? [...baseConditions, cursorCondition]
      : baseConditions

    const whereClause = and(...paginatedConditions)

    const ordering = effectiveAsc
      ? [descriptor.orderAsc, asc(hourBlocks.id)]
      : [descriptor.orderDesc, sql`${hourBlocks.id} DESC`]

    const rows = (await db
      .select({
        block: hourBlockSelection,
        client: clientSelection,
      })
      .from(hourBlocks)
      .leftJoin(clients, eq(hourBlocks.clientId, clients.id))
      .leftJoin(invoices, eq(hourBlocks.invoiceId, invoices.id))
      .where(whereClause)
      .orderBy(...ordering)
      .limit(limit + 1)) as HourBlockSelection[]

    hasExtraRecord = rows.length > limit
    const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
    const normalizedRows =
      direction === 'backward' ? [...slicedRows].reverse() : slicedRows

    hourBlocksList = normalizedRows.map(mapHourBlockWithClient)
  }

  const [totalResult, unfilteredTotalResult, clientDirectory] =
    await Promise.all([
      // Search touches the joined client name and invoice number, so the
      // filtered count needs the same joins as the page query.
      db
        .select({ count: sql<number>`count(*)` })
        .from(hourBlocks)
        .leftJoin(clients, eq(hourBlocks.clientId, clients.id))
        .leftJoin(invoices, eq(hourBlocks.invoiceId, invoices.id))
        .where(and(...baseConditions)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(hourBlocks)
        .where(statusCondition),
      db.select(clientSelection).from(clients).orderBy(asc(clients.name)),
    ])

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const unfilteredTotalCount = Number(unfilteredTotalResult[0]?.count ?? 0)
  const firstItem = hourBlocksList[0] ?? null
  const lastItem = hourBlocksList[hourBlocksList.length - 1] ?? null

  const pageInfo: PageInfo = {
    hasPreviousPage: useOffset
      ? input.offset! > 0
      : direction === 'forward'
        ? cursorPayloadPresent
        : hasExtraRecord,
    hasNextPage: useOffset
      ? input.offset! + limit < totalCount
      : direction === 'forward'
        ? hasExtraRecord
        : cursorPayloadPresent,
    startCursor: firstItem
      ? encodeSortCursor({
          sortField: sort.field,
          sortDirection: sort.direction,
          value: descriptor.encode(firstItem),
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeSortCursor({
          sortField: sort.field,
          sortDirection: sort.direction,
          value: descriptor.encode(lastItem),
          id: lastItem.id,
        })
      : null,
  }

  return {
    items: hourBlocksList,
    clients: clientDirectory.map(mapClientRow),
    totalCount,
    unfilteredTotalCount,
    pageInfo,
  }
}

export async function getActiveClientSummary(
  user: AppUser,
  clientId: string
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

/**
 * The full client directory the hour block sheet's client picker needs —
 * mirrors the directory `listHourBlocksForSettings` returns alongside pages.
 */
export async function listHourBlockClientDirectory(
  user: AppUser
): Promise<ClientRow[]> {
  assertAdmin(user)

  const rows = await db
    .select(clientSelection)
    .from(clients)
    .orderBy(asc(clients.name))

  return rows.map(mapClientRow)
}

/**
 * Active, numbered invoices for the hour block sheet's invoice picker.
 * Drafts have no invoice number yet (numbers mint on DRAFT → SENT), so they
 * are excluded — a block can only reference an invoice a client has seen.
 */
export async function listHourBlockInvoiceDirectory(
  user: AppUser
): Promise<HourBlockInvoiceRow[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
      clientName: clients.name,
      status: invoices.status,
      total: invoices.total,
      issuedDate: invoices.issuedDate,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        isNull(invoices.deletedAt),
        sql`${invoices.invoiceNumber} IS NOT NULL`
      )
    )
    .orderBy(sql`${invoices.createdAt} DESC`)

  return rows.map(row => ({
    id: row.id,
    invoice_number: row.invoiceNumber ?? '',
    client_id: row.clientId,
    client_name: row.clientName,
    status: row.status,
    total: Number(row.total ?? '0'),
    issued_date: row.issuedDate,
  }))
}

export async function getHourBlockWithClientById(
  user: AppUser,
  hourBlockId: string
): Promise<HourBlockWithClient | null> {
  assertAdmin(user)

  const rows = (await db
    .select({
      block: hourBlockSelection,
      client: clientSelection,
    })
    .from(hourBlocks)
    .leftJoin(clients, eq(hourBlocks.clientId, clients.id))
    .leftJoin(invoices, eq(hourBlocks.invoiceId, invoices.id))
    .where(eq(hourBlocks.id, hourBlockId))
    .limit(1)) as HourBlockSelection[]

  if (!rows.length) {
    return null
  }

  return mapHourBlockWithClient(rows[0]!)
}

function mapHourBlockWithClient(row: HourBlockSelection): HourBlockWithClient {
  const client =
    row.client && row.client.id
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
    invoice_id: row.block.invoiceId,
    invoice_number: row.block.invoiceNumber,
    notes: row.block.notes,
    created_by: row.block.createdBy,
    created_at: row.block.createdAt,
    updated_at: row.block.updatedAt,
    deleted_at: row.block.deletedAt,
    billing_month: row.block.billingMonth,
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
