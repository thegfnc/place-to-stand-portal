import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import {
  listClientsForSettings,
  type ClientsSettingsListItem,
} from '@/lib/queries/clients'
import type { DbClient } from '@/lib/types'

import { ClientsSettingsTable } from './clients-table'

export const metadata: Metadata = {
  title: 'Clients | Settings',
}

type ClientsSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type ClientRow = DbClient

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
  const params = searchParams ? await searchParams : {}
  const tabParamRaw = params.tab
  const tabParam =
    typeof tabParamRaw === 'string'
      ? tabParamRaw
      : Array.isArray(tabParamRaw)
        ? tabParamRaw[0]
        : 'clients'
  const tab: ClientsTab =
    tabParam === 'archive'
      ? 'archive'
      : tabParam === 'activity'
        ? 'activity'
        : 'clients'

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
        pageInfo={pageInfo}
        totalCount={totalCount}
      />
    </>
  )
}

type ClientsTab = 'clients' | 'archive' | 'activity'
