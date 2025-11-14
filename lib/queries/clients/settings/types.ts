import type { CursorDirection, PageInfo } from '@/lib/pagination/cursor'

import type { SelectClient } from '../selectors'

export type ClientListMetrics = {
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
  totalCount: number
  pageInfo: PageInfo
}

export type ListClientsForSettingsInput = {
  status?: 'active' | 'archived'
  search?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

