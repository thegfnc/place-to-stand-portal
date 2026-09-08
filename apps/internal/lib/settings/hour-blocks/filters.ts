import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

// PRD 004 §03: per-view sort allowlist (D6/R5). The single field has a
// matching descriptor (order expr + cursor encode/compare) in the query.
const HOUR_BLOCK_SORT_FIELDS = ['created'] as const
export type HourBlockSortField = (typeof HOUR_BLOCK_SORT_FIELDS)[number]

export const DEFAULT_HOUR_BLOCKS_SORT = {
  field: 'created',
  direction: 'desc',
} as const satisfies ParsedSort<HourBlockSortField>

export function isHourBlockSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (HOUR_BLOCK_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type HourBlocksSearchParams = {
  page: number
  search: string | undefined
  sort: ParsedSort<HourBlockSortField>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value[0]
  }
  return undefined
}

/** Shared searchParams parsing for the hour-blocks pages (offset paged). */
export function parseHourBlocksSearchParams(
  params: RawSearchParams
): HourBlocksSearchParams {
  const page = Math.max(
    1,
    Number.parseInt(firstParam(params.page) ?? '1', 10) || 1
  )
  const searchParam = firstParam(params.q)?.trim()
  const sort = parseSortParam(
    firstParam(params.sort),
    HOUR_BLOCK_SORT_FIELDS,
    DEFAULT_HOUR_BLOCKS_SORT
  )

  return {
    page,
    search: searchParam || undefined,
    sort,
  }
}
