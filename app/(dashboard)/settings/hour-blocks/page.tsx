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
  searchParams?: {
    tab?: string
    q?: string
    cursor?: string
    dir?: string
    limit?: string
  }
}

type HourBlocksTab = 'hour-blocks' | 'archive' | 'activity'

export default async function HourBlocksSettingsPage({
  searchParams,
}: HourBlocksSettingsPageProps) {
  const currentUser = await requireRole('ADMIN')

  const tabParam =
    typeof searchParams?.tab === 'string' ? searchParams.tab : 'hour-blocks'
  const tab: HourBlocksTab =
    tabParam === 'archive'
      ? 'archive'
      : tabParam === 'activity'
        ? 'activity'
        : 'hour-blocks'

  const status = tab === 'archive' ? 'archived' : 'active'
  const searchQuery =
    typeof searchParams?.q === 'string' ? searchParams.q : ''
  const cursor =
    typeof searchParams?.cursor === 'string' ? searchParams.cursor : null
  const directionParam =
    typeof searchParams?.dir === 'string' ? searchParams.dir : null
  const direction =
    directionParam === 'backward' ? 'backward' : ('forward' as const)
  const limitParam = Number.parseInt(
    typeof searchParams?.limit === 'string' ? searchParams.limit : '',
    10
  )

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
        searchQuery={searchQuery}
        pageInfo={pageInfo}
        totalCount={totalCount}
      />
    </>
  )
}
