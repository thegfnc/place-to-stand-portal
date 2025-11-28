'use server'

import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { type PageInfo } from '@/lib/pagination/cursor'

import {
  ACTIVE_STATUS,
  clientFields,
  clientGroupByColumns,
  type SelectClient,
} from '../selectors'
import { buildMembersByClient } from './members'
import { listClientUsers } from './users'
import {
  buildClientCursorCondition,
  buildSearchCondition,
  buildStatusCondition,
  decodeClientCursor,
  encodeClientCursor,
  resolveClientDirection,
  resolvePaginationLimit,
  type StatusFilter,
} from './pagination'
import type {
  ClientsSettingsListItem,
  ClientsSettingsResult,
  ListClientsForSettingsInput,
} from './types'

type ClientMetricsResult = SelectClient & {
  totalProjects: number | string | null
  activeProjects: number | string | null
}

function normalizeStatus(status?: string | null): StatusFilter {
  return status === 'archived' ? 'archived' : 'active'
}

function buildBaseConditions(
  status: StatusFilter,
  searchQuery: string,
): SQL[] {
  const conditions: SQL[] = [buildStatusCondition(status)]

  const searchCondition = buildSearchCondition(searchQuery)
  if (searchCondition) {
    conditions.push(searchCondition)
  }

  return conditions
}

async function queryClientRows(
  whereClause: SQL | undefined,
  ordering: SQL[],
  limit: number,
) {
  return db
    .select({
      ...clientFields,
      totalProjects: sql<number>`count(${projects.id})`,
      activeProjects: sql<number>`
        coalesce(sum(
          case
            when ${projects.deletedAt} is null
              and coalesce(lower(${projects.status}), '') = ${ACTIVE_STATUS}
            then 1
            else 0
          end
        ), 0)
      `,
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .where(whereClause)
    .groupBy(...clientGroupByColumns)
    .orderBy(...ordering)
    .limit(limit + 1) as Promise<ClientMetricsResult[]>
}

function mapClientMetrics(rows: ClientMetricsResult[]): ClientsSettingsListItem[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    billingType: row.billingType,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    metrics: {
      totalProjects: Number(row.totalProjects ?? 0),
      activeProjects: Number(row.activeProjects ?? 0),
    },
  }))
}

async function resolveTotalCount(conditions: SQL[]) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(clients)
    .where(conditions.length ? and(...conditions) : undefined)

  return Number(result[0]?.count ?? 0)
}

function buildPageInfo(
  direction: 'forward' | 'backward',
  cursorPayload: ReturnType<typeof decodeClientCursor>,
  items: ClientsSettingsListItem[],
  hasExtraRecord: boolean,
): PageInfo {
  const firstItem = items[0] ?? null
  const lastItem = items[items.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward'
      ? Boolean(cursorPayload)
      : hasExtraRecord
  const hasNextPage =
    direction === 'forward'
      ? hasExtraRecord
      : Boolean(cursorPayload)

  return {
    hasPreviousPage,
    hasNextPage,
    startCursor: encodeClientCursor(firstItem ? { name: firstItem.name ?? '', id: firstItem.id } : null),
    endCursor: encodeClientCursor(lastItem ? { name: lastItem.name ?? '', id: lastItem.id } : null),
  }
}

export async function listClientsForSettings(
  user: AppUser,
  input: ListClientsForSettingsInput = {},
): Promise<ClientsSettingsResult> {
  assertAdmin(user)

  const direction = resolveClientDirection(input.direction)
  const limit = resolvePaginationLimit(input.limit)
  const normalizedStatus = normalizeStatus(input.status)
  const searchQuery = input.search?.trim() ?? ''

  const baseConditions = buildBaseConditions(normalizedStatus, searchQuery)

  const cursorPayload = decodeClientCursor(input.cursor)
  const cursorCondition = buildClientCursorCondition(direction, cursorPayload)

  const whereClause =
    cursorCondition ? and(...baseConditions, cursorCondition) : and(...baseConditions)

  const ordering =
    direction === 'forward'
      ? [asc(clients.name), asc(clients.id)]
      : [desc(clients.name), desc(clients.id)]

  const rows = await queryClientRows(whereClause, ordering, limit)

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const mappedItems = mapClientMetrics(normalizedRows)

  const totalCount = await resolveTotalCount(baseConditions)
  const pageInfo = buildPageInfo(direction, cursorPayload, mappedItems, hasExtraRecord)

  const clientIds = mappedItems.map(item => item.id)

  const [membersByClient, clientUsers] = await Promise.all([
    buildMembersByClient(clientIds),
    listClientUsers(),
  ])

  return {
    items: mappedItems,
    membersByClient,
    clientUsers,
    totalCount,
    pageInfo,
  }
}

