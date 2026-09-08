import type { CursorDirection, PageInfo } from '@/lib/pagination/cursor'
import type { ParsedSort } from '@/lib/pagination/sort'
import type {
  ClientBillingFilter,
  ClientSortField,
} from '@/lib/settings/clients/filters'

import type { SelectClient } from '../selectors'

type ClientListMetrics = {
  totalProjects: number
  activeProjects: number
}

export type ClientsSettingsListItem = SelectClient & {
  metrics: ClientListMetrics
}

export type ClientsSettingsMembersMap = Record<
  string,
  Array<{
    id: string
    email: string
    fullName: string | null
  }>
>

export type ClientsSettingsResult = {
  items: ClientsSettingsListItem[]
  membersByClient: ClientsSettingsMembersMap
  clientUsers: Array<{
    id: string
    email: string
    fullName: string | null
  }>
  /** Rows matching the active filters/search (drives `Showing N of M`). */
  totalCount: number
  /** Rows on the tab regardless of filters/search (the `M`). */
  unfilteredTotalCount: number
  pageInfo: PageInfo
}

export type ListClientsForSettingsInput = {
  status?: 'active' | 'archived'
  billing?: ClientBillingFilter | null
  search?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
  sort?: ParsedSort<ClientSortField>
}

