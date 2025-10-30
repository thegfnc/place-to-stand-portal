import type { Metadata } from 'next'

import { ClientsSettingsTable } from './clients-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const metadata: Metadata = {
  title: 'Clients | Settings',
}

export default async function ClientsSettingsPage() {
  await requireRole('ADMIN')
  const supabase = getSupabaseServiceClient()

  const [
    { data: clients, error: clientsError },
    { data: clientMembers, error: clientMembersError },
    { data: clientUsers, error: clientUsersError },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select(
        `id, name, slug, notes, created_by, created_at, updated_at, deleted_at, projects:projects ( id, deleted_at, status )`
      )
      .order('name'),
    supabase
      .from('client_members')
      .select(
        `client_id, user:users ( id, email, full_name, role, deleted_at )`
      )
      .is('deleted_at', null),
    supabase
      .from('users')
      .select('id, email, full_name, role, deleted_at')
      .eq('role', 'CLIENT')
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .order('email', { ascending: true }),
  ])

  if (clientsError) {
    console.error('Failed to load clients for settings', clientsError)
  }

  if (clientMembersError) {
    console.error('Failed to load client memberships', clientMembersError)
  }

  if (clientUsersError) {
    console.error('Failed to load client users', clientUsersError)
  }

  const membersByClient = (clientMembers ?? []).reduce(
    (acc, entry) => {
      const user = entry.user

      if (!user || user.deleted_at) {
        return acc
      }

      const list = acc[entry.client_id] ?? []
      list.push({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      })
      acc[entry.client_id] = list
      return acc
    },
    {} as Record<
      string,
      Array<{ id: string; email: string; fullName: string | null }>
    >
  )

  const clientDirectory = (clientUsers ?? [])
    .filter(user => !user.deleted_at)
    .map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
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
        clients={
          (clients ?? []) as Parameters<
            typeof ClientsSettingsTable
          >[0]['clients']
        }
        clientUsers={clientDirectory}
        membersByClient={membersByClient}
      />
    </>
  )
}
