import { Buffer } from 'node:buffer'

export type CursorDirection = 'forward' | 'backward'

export type CursorPayload = Record<string, unknown>

export type PaginationOptions = {
  defaultLimit?: number
  maxLimit?: number
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export type PageInfo = {
  hasPreviousPage: boolean
  hasNextPage: boolean
  startCursor: string | null
  endCursor: string | null
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload ?? {})
  return Buffer.from(json, 'utf8').toString('base64url')
}

export function decodeCursor<T extends CursorPayload = CursorPayload>(
  cursor: string | null | undefined,
): T | null {
  if (!cursor) {
    return null
  }

  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8')
    const value = JSON.parse(json) as T
    if (value && typeof value === 'object') {
      return value
    }
    return null
  } catch {
    return null
  }
}

export function resolveDirection(
  direction: string | null | undefined,
): CursorDirection {
  return direction === 'backward' ? 'backward' : 'forward'
}

export function clampLimit(
  requested: number | null | undefined,
  options: PaginationOptions = {},
): number {
  const defaultLimit =
    typeof options.defaultLimit === 'number' && options.defaultLimit > 0
      ? Math.floor(options.defaultLimit)
      : DEFAULT_LIMIT
  const maxLimit =
    typeof options.maxLimit === 'number' && options.maxLimit >= defaultLimit
      ? Math.floor(options.maxLimit)
      : MAX_LIMIT

  if (!requested || Number.isNaN(requested)) {
    return defaultLimit
  }

  const normalized = Math.max(1, Math.floor(requested))
  return Math.min(normalized, maxLimit)
}

export function createSearchPattern(query: string): string {
  return `%${query.trim().replace(/\s+/g, '%')}%`
}

