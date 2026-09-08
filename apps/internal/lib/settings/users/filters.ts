import { userRole } from '@/lib/db/schema'
import type { UserRoleValue } from '@/lib/types'
import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

export const USER_ROLE_VALUES = userRole.enumValues

export const USER_ROLE_LABELS: Record<UserRoleValue, string> = {
  ADMIN: 'Admin',
  CLIENT: 'Client',
}

export function isUserRole(
  value: string | undefined
): value is UserRoleValue {
  return (
    typeof value === 'string' &&
    (USER_ROLE_VALUES as readonly string[]).includes(value)
  )
}

export const USER_ACCESS_VALUES = ['enabled', 'disabled'] as const

export type UserAccessFilter = (typeof USER_ACCESS_VALUES)[number]

export const USER_ACCESS_LABELS: Record<UserAccessFilter, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
}

export function isUserAccess(
  value: string | undefined
): value is UserAccessFilter {
  return (
    typeof value === 'string' &&
    (USER_ACCESS_VALUES as readonly string[]).includes(value)
  )
}

// PRD 004 §03: per-view sort allowlist (D6/R5). Each field here has a
// matching descriptor (order expr + cursor encode/compare) in the query.
const USER_SORT_FIELDS = ['name', 'created'] as const
export type UserSortField = (typeof USER_SORT_FIELDS)[number]

export const DEFAULT_USERS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<UserSortField>

export function isUserSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (USER_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type UsersSearchParams = {
  /** 1-based page number from `?page=`; invalid values fall back to 1. */
  page: number
  limit: number | undefined
  role: UserRoleValue | undefined
  access: UserAccessFilter | undefined
  search: string | undefined
  sort: ParsedSort<UserSortField>
  /** Raw validated `?sort=` value for the client controls (undefined = default). */
  sortParam: string | undefined
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
 * Shared searchParams parsing for the users settings pages (the verbose
 * cursor/dir/limit ternaries were previously duplicated verbatim across the
 * active and archive pages). Invalid role/access values fail the type guards
 * and are treated as unset, matching the submissions convention.
 */
export function parseUsersSearchParams(params: RawSearchParams): UsersSearchParams {
  const pageParam = Number.parseInt(firstParam(params.page) ?? '', 10)
  const limitParam = Number.parseInt(firstParam(params.limit) ?? '', 10)
  const roleParam = firstParam(params.role)
  const accessParam = firstParam(params.access)
  const searchParam = firstParam(params.q)?.trim()
  const rawSort = firstParam(params.sort)
  const sort = parseSortParam(rawSort, USER_SORT_FIELDS, DEFAULT_USERS_SORT)

  return {
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
    role: isUserRole(roleParam) ? roleParam : undefined,
    access: isUserAccess(accessParam) ? accessParam : undefined,
    search: searchParam || undefined,
    sort,
    sortParam: rawSort && isUserSortValue(rawSort) ? rawSort : undefined,
  }
}
