import type { Metadata } from 'next'

import { ClientsSettingsTable } from './clients-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { getClientsSettingsSnapshot } from '@/lib/queries/clients'
import type { Database } from '@/supabase/types/database'

export const metadata: Metadata = {
  title: 'Clients | Settings',
}

export default async function ClientsSettingsPage() {
  const admin = await requireRole('ADMIN')
  const { clients, members, clientUsers } = await getClientsSettingsSnapshot(
    admin
  )

  const clientsForTable = clients.map(client => ({
    id: client.id,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    created_by: client.createdBy,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
    projects: client.projects.map(project => ({
      id: project.id,
      deleted_at: project.deletedAt,
      status: project.status,
    })),
  })) as Array<
    Database['public']['Tables']['clients']['Row'] & {
      projects: Array<{
        id: string
        deleted_at: string | null
        status: string | null
      }>
    }
  >

  const membersByClient = members.reduce<
    Record<
      string,
      Array<{ id: string; email: string; fullName: string | null }>
    >
  >((acc, member) => {
    const list = acc[member.clientId] ?? []
    list.push({
      id: member.userId,
      email: member.email,
      fullName: member.fullName,
    })
    acc[member.clientId] = list
    return acc
  }, {})

  const clientDirectory = clientUsers.map(user => ({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  }))

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
        clientUsers={clientDirectory}
        membersByClient={membersByClient}
      />
    </>
  )
}
