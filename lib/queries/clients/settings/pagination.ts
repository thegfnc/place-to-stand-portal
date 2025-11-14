import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { clients } from '@/lib/db/schema'
import {
  clampLimit,
  createSearchPattern,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type CursorDirection,
} from '@/lib/pagination/cursor'

export type ClientCursorPayload = { name?: string; id?: string }

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

export function buildSearchCondition(search: string | null | undefined): SQL | null {
  const trimmed = search?.trim()
  if (!trimmed) {
    return null
  }

  const pattern = createSearchPattern(trimmed)
  return sql`(${clients.name} ILIKE ${pattern} OR ${clients.slug} ILIKE ${pattern})`
}

export function buildClientCursorCondition(
  direction: CursorDirection,
  cursor: ClientCursorPayload | null,
) {
  if (!cursor) {
    return null
  }

  const nameValue =
    typeof cursor.name === 'string' ? cursor.name : (cursor.name ?? '')
  const idValue = typeof cursor.id === 'string' ? cursor.id : ''

  if (!idValue) {
    return null
  }

  const normalizedName = sql`coalesce(${clients.name}, '')`

  if (direction === 'forward') {
    return sql`${normalizedName} > ${nameValue} OR (${normalizedName} = ${nameValue} AND ${clients.id} > ${idValue})`
  }

  return sql`${normalizedName} < ${nameValue} OR (${normalizedName} = ${nameValue} AND ${clients.id} < ${idValue})`
}

export const DEFAULT_LIMITS = { defaultLimit: 20, maxLimit: 100 } as const

export function resolvePaginationLimit(limit: number | null | undefined) {
  return clampLimit(limit, DEFAULT_LIMITS)
}

export function decodeClientCursor(cursor: string | null | undefined) {
  return decodeCursor<ClientCursorPayload>(cursor)
}

export function encodeClientCursor(payload: ClientCursorPayload | null) {
  if (!payload) return null
  return encodeCursor({
    name: payload.name ?? '',
    id: payload.id ?? '',
  })
}

export function resolveClientDirection(direction: CursorDirection | null | undefined) {
  return resolveDirection(direction)
}

