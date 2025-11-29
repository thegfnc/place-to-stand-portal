import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { fetchClientsWithMetrics } from '@/lib/data/clients'
import { listClientsForSettings } from '@/lib/queries/clients'

import { ClientsLanding } from './_components/clients-landing'
import { ClientsLandingHeader } from './_components/clients-landing-header'
import { ClientsTabsNav } from './_components/clients-tabs-nav'
import { ClientsAddButton } from './_components/clients-add-button'
import {
  normalizeClientMembersMap,
  normalizeClientUsers,
} from './_lib/client-user-helpers'

export const metadata: Metadata = {
  title: 'Clients | Place to Stand Portal',
}

type ClientsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientsPage({
  searchParams,
}: ClientsPageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}
  const canManageClients = isAdmin(user)
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

  const managementDataPromise = canManageClients
    ? listClientsForSettings(user, {
        status: 'active',
        search: searchQuery,
        cursor,
        direction,
        limit: Number.isFinite(limitParam) ? limitParam : undefined,
      })
    : Promise.resolve(null)

  const [clients, managementData] = await Promise.all([
    fetchClientsWithMetrics(user),
    managementDataPromise,
  ])

  const clientUsers = managementData
    ? normalizeClientUsers(managementData.clientUsers)
    : []
  const membersByClient = managementData
    ? normalizeClientMembersMap(managementData.membersByClient)
    : {}
  return (
    <>
      <AppShellHeader>
        <ClientsLandingHeader clients={clients} />
      </AppShellHeader>
      <div className='space-y-6'>
        <div className='flex flex-wrap items-center gap-4'>
          <ClientsTabsNav activeTab='clients' className='flex-1 sm:flex-none' />
          {canManageClients && managementData ? (
            <div className='flex items-center gap-6 ml-auto'>
              <span className='text-muted-foreground text-sm whitespace-nowrap'>
                Total clients: {managementData.totalCount}
              </span>
              <ClientsAddButton
                clientUsers={clientUsers}
                clientMembers={membersByClient}
              />
            </div>
          ) : null}
        </div>
        <ClientsLanding clients={clients} />
      </div>
    </>
  )
}

