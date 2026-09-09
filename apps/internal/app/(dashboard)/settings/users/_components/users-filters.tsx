'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  DEFAULT_USER_ACCESS,
  isUserAccess,
  isUserRole,
  USER_ACCESS_LABELS,
  USER_ACCESS_VALUES,
  USER_ROLE_LABELS,
  USER_ROLE_VALUES,
  type UserAccessFilter,
} from '@/lib/settings/users/filters'
import type { UserRoleValue } from '@/lib/types'

const ROLE_OPTIONS = USER_ROLE_VALUES.map(value => ({
  value,
  label: USER_ROLE_LABELS[value],
}))

// `all` is the select's placeholder row, not a listed option.
const ACCESS_OPTIONS = USER_ACCESS_VALUES.filter(value => value !== 'all').map(
  value => ({
    value,
    label: USER_ACCESS_LABELS[value],
  })
)

type UsersFiltersProps = {
  role?: UserRoleValue
  /** Resolved access filter (defaults to enabled) — active tab only. */
  access?: UserAccessFilter
  search?: string
  showAccessFilter: boolean
  /** Base path to push filter changes to — '/settings/users' or '/settings/users/archive'. */
  basePath: string
}

export function UsersFilters({
  role,
  access,
  search,
  showAccessFilter,
  basePath,
}: UsersFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      role: { isValid: value => isUserRole(value) },
      access: {
        isValid: value => isUserAccess(value),
        defaultValue: DEFAULT_USER_ACCESS,
      },
      q: {},
    },
  })

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search users…'
      />
      <FilterSelect
        value={role}
        onChange={value => update({ role: value })}
        placeholder='All users'
        options={ROLE_OPTIONS}
      />
      {showAccessFilter ? (
        <FilterSelect
          value={access === 'all' ? undefined : access}
          onChange={value =>
            // Enabled is the implicit default (clean URL); "All access" must
            // be explicit or removing the param would snap back to enabled.
            update({
              access:
                value === DEFAULT_USER_ACCESS ? undefined : (value ?? 'all'),
            })
          }
          placeholder={USER_ACCESS_LABELS.all}
          options={ACCESS_OPTIONS}
        />
      ) : null}
      <ResetFiltersButton show={hasActiveFilters} onReset={reset} />
    </FilterBar>
  )
}
