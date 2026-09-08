import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { clients } from '@/lib/db/schema'
import {
  clampLimit,
  createSearchPattern,
  resolveDirection,
  type CursorDirection,
} from '@/lib/pagination/cursor'
import type {
  ClientBillingFilter,
  ClientSortField,
} from '@/lib/settings/clients/filters'

import type { ClientsSettingsListItem } from './types'

export function normalizeStatus(status?: string | null) {
  return status === 'archived' ? 'archived' : 'active'
}

export type StatusFilter = 'active' | 'archived'

export function buildStatusCondition(status: StatusFilter): SQL {
  if (status === 'archived') {
    return sql`${clients.deletedAt} IS NOT NULL`
  }

  return sql`${clients.deletedAt} IS NULL`
}

export function buildBillingCondition(
  billing: ClientBillingFilter | null | undefined
): SQL | null {
  if (!billing) {
    return null
  }

  return sql`${clients.billingType} = ${billing}`
}

export function buildSearchCondition(search: string | null | undefined): SQL | null {
  const trimmed = search?.trim()
  if (!trimmed) {
    return null
  }

  const pattern = createSearchPattern(trimmed)
  return sql`(${clients.name} ILIKE ${pattern} OR ${clients.slug} ILIKE ${pattern})`
}

/**
 * Per-sort descriptor (PRD 004 §03, R5): order expression + cursor value
 * encoding + comparison predicates per field, mirroring
 * `USER_SORT_DESCRIPTORS`. Both fields are non-nullable so no null
 * partition applies.
 */
export type ClientSortDescriptor = {
  encode: (row: ClientsSettingsListItem) => string
  compare: (op: 'gt' | 'lt', value: string) => SQL
  equals: (value: string) => SQL
  orderAsc: SQL
  orderDesc: SQL
}

export const CLIENT_SORT_DESCRIPTORS: Record<
  ClientSortField,
  ClientSortDescriptor
> = {
  name: {
    encode: row => row.name ?? '',
    compare: (op, value) =>
      op === 'gt'
        ? sql`${clients.name} > ${value}`
        : sql`${clients.name} < ${value}`,
    equals: value => sql`${clients.name} = ${value}`,
    orderAsc: sql`${clients.name} ASC`,
    orderDesc: sql`${clients.name} DESC`,
  },
  created: {
    encode: row => String(row.createdAt),
    compare: (op, value) =>
      op === 'gt'
        ? sql`${clients.createdAt} > ${value}::timestamptz`
        : sql`${clients.createdAt} < ${value}::timestamptz`,
    equals: value => sql`${clients.createdAt} = ${value}::timestamptz`,
    orderAsc: sql`${clients.createdAt} ASC`,
    orderDesc: sql`${clients.createdAt} DESC`,
  },
}

const DEFAULT_LIMITS = { defaultLimit: 20, maxLimit: 100 } as const

export function resolvePaginationLimit(limit: number | null | undefined) {
  return clampLimit(limit, DEFAULT_LIMITS)
}

export function resolveClientDirection(direction: CursorDirection | null | undefined) {
  return resolveDirection(direction)
}
