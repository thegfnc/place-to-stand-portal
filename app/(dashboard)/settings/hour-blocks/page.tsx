import type { Metadata } from 'next'

import { HourBlocksSettingsTable } from './hour-blocks-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import {
  listHourBlocksForSettings,
} from '@/lib/queries/hour-blocks'

export const metadata: Metadata = {
  title: 'Hour Blocks | Settings',
}

type HourBlocksSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type HourBlocksTab = 'hour-blocks' | 'archive' | 'activity'

export default async function HourBlocksSettingsPage({
  searchParams,
}: HourBlocksSettingsPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const tabParamRaw = params.tab
  const tabParam =
    typeof tabParamRaw === 'string'
      ? tabParamRaw
      : Array.isArray(tabParamRaw)
        ? tabParamRaw[0]
        : 'hour-blocks'

  const tab: HourBlocksTab =
    tabParam === 'archive'
      ? 'archive'
      : tabParam === 'activity'
        ? 'activity'
        : 'hour-blocks'

  const status = tab === 'archive' ? 'archived' : 'active'
  const searchQuery =
    typeof params.q === 'string'
      ? params.q
      : Array.isArray(params.q)
        ? params.q[0] ?? ''
        : ''
  const cursor =
    typeof params.cursor === 'string'
      ? params.cursor
      : Array.isArray(params.cursor)
        ? params.cursor[0] ?? null
        : null
  const directionParam =
    typeof params.dir === 'string'
      ? params.dir
      : Array.isArray(params.dir)
        ? params.dir[0] ?? null
        : null
  const direction =
    directionParam === 'backward' ? 'backward' : ('forward' as const)
  const limitParamRaw =
    typeof params.limit === 'string'
      ? params.limit
      : Array.isArray(params.limit)
        ? params.limit[0]
        : undefined
  const limitParam = Number.parseInt(limitParamRaw ?? '', 10)

  const { items, clients, totalCount, pageInfo } =
    await listHourBlocksForSettings(currentUser, {
      status,
      search: searchQuery,
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    })

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Hour Blocks</h1>
          <p className='text-muted-foreground text-sm'>
            Track purchased hour blocks by client for quick allocation
            visibility.
          </p>
        </div>
      </AppShellHeader>
      <HourBlocksSettingsTable
        hourBlocks={items}
        clients={clients}
        tab={tab}
        pageInfo={pageInfo}
        totalCount={totalCount}
      />
    </>
  )
}
