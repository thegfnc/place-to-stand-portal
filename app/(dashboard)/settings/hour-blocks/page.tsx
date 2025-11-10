import type { Metadata } from 'next'

import { HourBlocksSettingsTable } from './hour-blocks-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import {
  getHourBlocksSettingsSnapshot,
  type HourBlockSettingsSnapshot,
} from '@/lib/queries/hour-blocks'

export const metadata: Metadata = {
  title: 'Hour Blocks | Settings',
}

export default async function HourBlocksSettingsPage() {
  const currentUser = await requireRole('ADMIN')
  const { hourBlocks, clients }: HourBlockSettingsSnapshot =
    await getHourBlocksSettingsSnapshot(currentUser)

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
      <HourBlocksSettingsTable hourBlocks={hourBlocks} clients={clients} />
    </>
  )
}
