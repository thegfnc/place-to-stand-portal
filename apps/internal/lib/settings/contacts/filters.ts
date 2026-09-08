import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'
import { UUID_PATTERN } from '@/lib/sheets/entities'

// PRD 004 §03: per-view sort allowlist (D6/R5). Each field here has a
// matching descriptor (order expr + cursor encode/compare) in the query.
const CONTACT_SORT_FIELDS = [
  'name',
  'email',
  'phone',
  'clients',
  'created',
] as const
export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number]

export const DEFAULT_CONTACTS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<ContactSortField>

export function isContactSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (CONTACT_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type ContactsSearchParams = {
  /** 1-based page for the offset-paginated contacts tables. */
  page: number
  search: string | undefined
  /**
   * Linked-client filter (`?clientId=<uuid>`). Named `clientId` because
   * `?client=` is the client sheet's deep-link param.
   */
  clientId: string | undefined
  sort: ParsedSort<ContactSortField>
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
 * Shared searchParams parsing for the contacts pages (active + archive),
 * mirroring `parseUsersSearchParams`. Contacts paginate by offset, so the
 * pagination key here is `page` rather than cursor/dir.
 */
export function parseContactsSearchParams(
  params: RawSearchParams
): ContactsSearchParams {
  const pageParam = Number.parseInt(firstParam(params.page) ?? '1', 10)
  const searchParam = firstParam(params.q)?.trim()
  const clientIdParam = firstParam(params.clientId)?.trim()
  const sort = parseSortParam(
    firstParam(params.sort),
    CONTACT_SORT_FIELDS,
    DEFAULT_CONTACTS_SORT
  )

  return {
    page: Math.max(1, Number.isFinite(pageParam) ? pageParam : 1),
    search: searchParam || undefined,
    clientId:
      clientIdParam && UUID_PATTERN.test(clientIdParam)
        ? clientIdParam
        : undefined,
    sort,
  }
}
