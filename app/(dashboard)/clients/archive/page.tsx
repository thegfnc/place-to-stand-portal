import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listClientsForSettings } from '@/lib/queries/clients'

import { ClientsTabsNav } from '../_components/clients-tabs-nav'
import { ClientsManagementTable } from '../_components/clients-management-table'
import {
  normalizeClientMembersMap,
  normalizeClientUsers,
} from '../_lib/client-user-helpers'
import { mapClientToTableRow } from '../_lib/map-client-to-table-row'

type ClientsArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Client Archive | Place to Stand Portal',
}

export default async function ClientsArchivePage({
  searchParams,
}: ClientsArchivePageProps) {
  const admin = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

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

  const { items, membersByClient, clientUsers, totalCount, pageInfo } =
    await listClientsForSettings(admin, {
      status: 'archived',
      search: searchQuery,
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    })

  const clientsForTable = items.map(mapClientToTableRow)

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Clients</h1>
          <p className='text-muted-foreground text-sm'>
            Review archived organizations and restore them when work resumes.
          </p>
        </div>
      </AppShellHeader>
        <div className='space-y-4'>
          <div className='flex flex-wrap items-center gap-4'>
            <ClientsTabsNav activeTab='archive' className='flex-1 sm:flex-none' />
          </div>
          <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
            <ClientsManagementTable
              clients={clientsForTable}
              clientUsers={normalizeClientUsers(clientUsers)}
              membersByClient={normalizeClientMembersMap(membersByClient)}
              pageInfo={pageInfo}
              totalCount={totalCount}
              mode='archive'
            />
          </section>
        </div>
    </>
  )
}
