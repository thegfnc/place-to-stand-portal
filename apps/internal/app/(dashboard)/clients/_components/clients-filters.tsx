'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  CLIENT_BILLING_LABELS,
  CLIENT_BILLING_VALUES,
  isClientBilling,
  type ClientBillingFilter,
} from '@/lib/settings/clients/filters'

const BILLING_OPTIONS = CLIENT_BILLING_VALUES.map(value => ({
  value,
  label: CLIENT_BILLING_LABELS[value],
}))

type ClientsFiltersProps = {
  search?: string
  billing?: ClientBillingFilter
  /** Base path to push filter changes to — '/clients' or '/clients/archive'. */
  basePath: string
}

export function ClientsFilters({
  search,
  billing,
  basePath,
}: ClientsFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['cursor', 'dir', 'page'],
    filters: {
      billing: { isValid: value => isClientBilling(value) },
      q: {},
    },
  })

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search clients…'
      />
      <FilterSelect
        value={billing}
        onChange={value => update({ billing: value })}
        placeholder='All billing'
        options={BILLING_OPTIONS}
      />
      <ResetFiltersButton show={hasActiveFilters} onReset={reset} />
    </FilterBar>
  )
}
