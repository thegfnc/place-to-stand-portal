import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { IntegrationsPanel } from './integrations-panel'

export const metadata: Metadata = {
  title: 'Integrations | Settings',
}

export default function IntegrationsSettingsPage() {
  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Integrations</h1>
          <p className='text-muted-foreground text-sm'>
            Manage your external account connections.
          </p>
        </div>
      </AppShellHeader>
      <IntegrationsPanel />
    </>
  )
}
