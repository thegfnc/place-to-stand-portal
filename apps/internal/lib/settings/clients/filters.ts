import { clientBillingType } from '@/lib/db/schema'
import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

export const CLIENT_BILLING_VALUES = clientBillingType.enumValues

export type ClientBillingFilter = (typeof CLIENT_BILLING_VALUES)[number]

export const CLIENT_BILLING_LABELS: Record<ClientBillingFilter, string> = {
  prepaid: 'Prepaid',
  net_30: 'Net 30',
}

export function isClientBilling(
  value: string | undefined
): value is ClientBillingFilter {
  return (
    typeof value === 'string' &&
    (CLIENT_BILLING_VALUES as readonly string[]).includes(value)
  )
}

// PRD 004 §03: per-view sort allowlist (D6/R5). Each field here has a
// matching descriptor (order expr + cursor encode/compare) in the query.
const CLIENT_SORT_FIELDS = ['name', 'created'] as const
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number]

/**
 * Landing-table allowlist. The landing view is unpaginated, so it sorts the
 * fetched array in memory and can order by computed metrics (active project
 * count, remaining hours, joined partner names) that have no SQL descriptor.
 * Those fields live HERE only — `CLIENT_SORT_FIELDS` stays the keyset-safe
 * set the archive query resolves against `CLIENT_SORT_DESCRIPTORS`.
 */
const CLIENT_LANDING_SORT_FIELDS = [
  ...CLIENT_SORT_FIELDS,
  'billing',
  'projects',
  'hours',
  'origination',
  'closer',
] as const
export type ClientLandingSortField =
  (typeof CLIENT_LANDING_SORT_FIELDS)[number]

export const DEFAULT_CLIENTS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<ClientSortField>

export function isClientSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (CLIENT_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

export function isClientLandingSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (CLIENT_LANDING_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type ClientsSearchParams = {
  cursor: string | null
  direction: 'forward' | 'backward'
  limit: number | undefined
  billing: ClientBillingFilter | undefined
  search: string | undefined
  sort: ParsedSort<ClientSortField>
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

/**
 * Shared searchParams parsing for the clients pages (landing + archive),
 * mirroring `parseUsersSearchParams`. Invalid sort values fall back to the
 * view default via the allowlist.
 */
export function parseClientsSearchParams(
  params: RawSearchParams
): ClientsSearchParams {
  const cursor = firstParam(params.cursor) ?? null
  const direction =
    firstParam(params.dir) === 'backward' ? 'backward' : ('forward' as const)
  const limitParam = Number.parseInt(firstParam(params.limit) ?? '', 10)
  const billingParam = firstParam(params.billing)
  const searchParam = firstParam(params.q)?.trim()
  const sort = parseSortParam(
    firstParam(params.sort),
    CLIENT_SORT_FIELDS,
    DEFAULT_CLIENTS_SORT
  )

  return {
    cursor,
    direction,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
    billing: isClientBilling(billingParam) ? billingParam : undefined,
    search: searchParam || undefined,
    sort,
  }
}

/**
 * Resolve `?sort=` against the wider landing allowlist. Read alongside
 * `parseClientsSearchParams` on the landing page: that call keeps returning
 * the keyset-safe sort for the paginated query (a landing-only field falls
 * back to the default there), while this one drives the in-memory sort.
 */
export function parseClientsLandingSort(
  params: RawSearchParams
): ParsedSort<ClientLandingSortField> {
  return parseSortParam(
    firstParam(params.sort),
    CLIENT_LANDING_SORT_FIELDS,
    DEFAULT_CLIENTS_SORT
  )
}
