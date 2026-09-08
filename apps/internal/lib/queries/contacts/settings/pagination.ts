import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { contacts } from '@/lib/db/schema'
import {
  clampLimit,
  createSearchPattern,
  resolveDirection,
  type CursorDirection,
} from '@/lib/pagination/cursor'
import type { ContactSortField } from '@/lib/settings/contacts/filters'

import type { ContactsSettingsListItem } from './types'

export type StatusFilter = 'active' | 'archived'

export function normalizeStatus(status?: string | null): StatusFilter {
  return status === 'archived' ? 'archived' : 'active'
}

export function buildStatusCondition(status: StatusFilter): SQL {
  if (status === 'archived') {
    return sql`${contacts.deletedAt} IS NOT NULL`
  }

  return sql`${contacts.deletedAt} IS NULL`
}

export function buildSearchCondition(search: string | null | undefined): SQL | null {
  const trimmed = search?.trim()
  if (!trimmed) {
    return null
  }

  const pattern = createSearchPattern(trimmed)
  return sql`(${contacts.email} ILIKE ${pattern} OR ${contacts.name} ILIKE ${pattern})`
}

/**
 * Linked-client filter: keeps contacts with a live link to the given client.
 * Mirrors the Linked Clients cell semantics (archived clients don't count).
 * Raw identifiers for the same dequalification reason as
 * `linkedClientsCountSql` below.
 */
export function buildClientCondition(
  clientId: string | null | undefined
): SQL | null {
  if (!clientId) {
    return null
  }

  return sql`exists (
    select 1
    from contact_clients cc
    inner join clients c
      on c.id = cc.client_id
      and c.deleted_at is null
    where cc.contact_id = contacts.id
      and cc.client_id = ${clientId}
  )`
}

/**
 * Live linked-client count as a correlated subquery: counts only links to
 * non-archived clients so sorting (and the count the row displays) matches
 * the names shown in the Linked Clients cell, which filters archived
 * clients out.
 *
 * Raw identifiers throughout: drizzle dequalifies interpolated columns when
 * a fragment is used as a selected field, which breaks references inside a
 * correlated subquery ("cc.contact_id = id" instead of "= contacts.id").
 */
export const linkedClientsCountSql = sql<number>`(
  select count(*)
  from contact_clients cc
  inner join clients c
    on c.id = cc.client_id
    and c.deleted_at is null
  where cc.contact_id = contacts.id
)`

/**
 * Per-sort descriptor (PRD 004 §03, R5): order expression + cursor value
 * encoding + comparison predicates per field, mirroring
 * `USER_SORT_DESCRIPTORS`. `phone` is nullable and sorts NULLS LAST in both
 * directions; its cursor encodes null as '' (phones are never empty
 * strings). The cursor path is only exercised by the default name sort
 * today — the contacts pages paginate by offset — so the null boundary
 * doesn't need exact backward-pagination semantics.
 */
export type ContactSortDescriptor = {
  encode: (row: ContactsSettingsListItem) => string
  compare: (op: 'gt' | 'lt', value: string) => SQL
  equals: (value: string) => SQL
  orderAsc: SQL
  orderDesc: SQL
}

export const CONTACT_SORT_DESCRIPTORS: Record<
  ContactSortField,
  ContactSortDescriptor
> = {
  name: {
    encode: row => row.name ?? '',
    compare: (op, value) =>
      op === 'gt'
        ? sql`${contacts.name} > ${value}`
        : sql`${contacts.name} < ${value}`,
    equals: value => sql`${contacts.name} = ${value}`,
    orderAsc: sql`${contacts.name} ASC`,
    orderDesc: sql`${contacts.name} DESC`,
  },
  email: {
    encode: row => row.email,
    compare: (op, value) =>
      op === 'gt'
        ? sql`${contacts.email} > ${value}`
        : sql`${contacts.email} < ${value}`,
    equals: value => sql`${contacts.email} = ${value}`,
    orderAsc: sql`${contacts.email} ASC`,
    orderDesc: sql`${contacts.email} DESC`,
  },
  phone: {
    encode: row => row.phone ?? '',
    // Nulls sort last in both directions, so nothing follows a null cursor
    // value-wise (the id tiebreak covers the null partition itself).
    compare: (op, value) =>
      value === ''
        ? sql`false`
        : op === 'gt'
          ? sql`(${contacts.phone} > ${value} OR ${contacts.phone} IS NULL)`
          : sql`(${contacts.phone} < ${value} OR ${contacts.phone} IS NULL)`,
    equals: value =>
      value === ''
        ? sql`${contacts.phone} IS NULL`
        : sql`${contacts.phone} = ${value}`,
    orderAsc: sql`${contacts.phone} ASC NULLS LAST`,
    orderDesc: sql`${contacts.phone} DESC NULLS LAST`,
  },
  clients: {
    encode: row => String(row.metrics.totalClients),
    compare: (op, value) =>
      op === 'gt'
        ? sql`${linkedClientsCountSql} > ${Number.parseInt(value, 10) || 0}`
        : sql`${linkedClientsCountSql} < ${Number.parseInt(value, 10) || 0}`,
    equals: value =>
      sql`${linkedClientsCountSql} = ${Number.parseInt(value, 10) || 0}`,
    orderAsc: sql`${linkedClientsCountSql} ASC`,
    orderDesc: sql`${linkedClientsCountSql} DESC`,
  },
  created: {
    encode: row => String(row.createdAt),
    compare: (op, value) =>
      op === 'gt'
        ? sql`${contacts.createdAt} > ${value}::timestamptz`
        : sql`${contacts.createdAt} < ${value}::timestamptz`,
    equals: value => sql`${contacts.createdAt} = ${value}::timestamptz`,
    orderAsc: sql`${contacts.createdAt} ASC`,
    orderDesc: sql`${contacts.createdAt} DESC`,
  },
}

const DEFAULT_LIMITS = { defaultLimit: 20, maxLimit: 100 } as const

export function resolvePaginationLimit(limit: number | null | undefined) {
  return clampLimit(limit, DEFAULT_LIMITS)
}

export function resolveContactDirection(direction: CursorDirection | null | undefined) {
  return resolveDirection(direction)
}
