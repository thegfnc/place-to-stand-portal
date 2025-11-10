import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import {
  listClientsForSettings,
  type ClientsSettingsListItem,
} from '@/lib/queries/clients'
import type { Database } from '@/supabase/types/database'

import { ClientsSettingsTable } from './clients-table'

export const metadata: Metadata = {
  title: 'Clients | Settings',
}

type ClientsSettingsPageProps = {
  searchParams?: {
    tab?: string
    q?: string
    cursor?: string
    dir?: string
    limit?: string
  }
}

type ClientRow = Database['public']['Tables']['clients']['Row']

function mapClientToTableRow(client: ClientsSettingsListItem): ClientRow & {
  metrics: {
    active_projects: number
    total_projects: number
  }
} {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    created_by: client.createdBy,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
    metrics: {
      active_projects: client.metrics.activeProjects,
      total_projects: client.metrics.totalProjects,
    },
  }
}

export default async function ClientsSettingsPage({
  searchParams,
}: ClientsSettingsPageProps) {
  const admin = await requireRole('ADMIN')
  const tabParam =
    typeof searchParams?.tab === 'string' ? searchParams.tab : 'clients'
  const tab: ClientsTab =
    tabParam === 'archive'
      ? 'archive'
      : tabParam === 'activity'
        ? 'activity'
        : 'clients'

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

  const { items, membersByClient, clientUsers, totalCount, pageInfo } =
    await listClientsForSettings(admin, {
      status,
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
            Track active organizations and control which projects roll up to
            each client.
          </p>
        </div>
      </AppShellHeader>
      <ClientsSettingsTable
        clients={clientsForTable}
        clientUsers={clientUsers}
        membersByClient={membersByClient}
        tab={tab}
        searchQuery={searchQuery}
        pageInfo={pageInfo}
        totalCount={totalCount}
      />
    </>
  )
}

type ClientsTab = 'clients' | 'archive' | 'activity'
