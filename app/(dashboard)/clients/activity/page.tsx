import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'

import { ClientsTabsNav } from '../_components/clients-tabs-nav'
import { ClientsActivitySection } from '../_components/clients-activity-section'

export const metadata: Metadata = {
  title: 'Client Activity | Place to Stand Portal',
}

export default async function ClientsActivityPage() {
  await requireRole('ADMIN')

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Clients</h1>
          <p className='text-muted-foreground text-sm'>
            Review client-level changes to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-4'>
          <ClientsTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
        </div>
        <ClientsActivitySection />
      </div>
    </>
  )
}
