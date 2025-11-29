import type { CursorDirection } from '@/lib/pagination/cursor'

type RawParams = Record<string, string | string[] | undefined>

type ParsedProjectsSearchParams = {
  searchQuery: string | null
  cursor: string | null
  direction: CursorDirection
  limit: number | undefined
}

export function parseProjectsSearchParams(
  params: RawParams,
): ParsedProjectsSearchParams {
  const searchQuery = extractParam(params.q)
  const cursor = extractParam(params.cursor)
  const directionParam = extractParam(params.dir)
  const direction: CursorDirection =
    directionParam === 'backward' ? 'backward' : 'forward'
  const limitRaw = extractParam(params.limit)
  const limit = Number.parseInt(limitRaw ?? '', 10)

  return {
    searchQuery,
    cursor,
    direction,
    limit: Number.isFinite(limit) ? limit : undefined,
  }
}

function extractParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return null
}
