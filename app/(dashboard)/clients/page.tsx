import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireUser } from '@/lib/auth/session'
import { fetchClientsWithMetrics } from '@/lib/data/clients'

import { ClientsLanding } from './_components/clients-landing'
import { ClientsLandingHeader } from './_components/clients-landing-header'

export const metadata: Metadata = {
  title: 'Clients | Place to Stand Portal',
}

export default async function ClientsPage() {
  const user = await requireUser()
  const clients = await fetchClientsWithMetrics(user)

  return (
    <>
      <AppShellHeader>
        <ClientsLandingHeader clients={clients} />
      </AppShellHeader>
      <div className='space-y-6'>
        <ClientsLanding clients={clients} />
      </div>
    </>
  )
}

