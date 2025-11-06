import type { Metadata } from 'next'

import { ProjectsSettingsTable } from './projects-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/supabase/types/database'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

type ProjectWithClient = ProjectRow & { client: ClientRow | null }

export const metadata: Metadata = {
  title: 'Projects | Settings',
}

export default async function ProjectsSettingsPage() {
  await requireRole('ADMIN')

  const supabase = getSupabaseServiceClient()

  const [
    { data: projects, error: projectsError },
    { data: clients, error: clientsError },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select(
        `
          id,
          name,
          status,
          slug,
          client_id,
          created_by,
          starts_on,
          ends_on,
          created_at,
          updated_at,
          deleted_at
        `
      )
      .order('name', { ascending: true }),
    supabase.from('clients').select('id, name, deleted_at').order('name'),
  ])

  if (projectsError) {
    console.error('Failed to load projects for settings', projectsError)
  }

  if (clientsError) {
    console.error('Failed to load clients for project settings', clientsError)
  }

  const clientLookup = new Map(
    (clients ?? []).map(client => [client.id, client] as const)
  )

  const hydratedProjects: ProjectWithClient[] = (projects ?? []).map(
    project => ({
      ...project,
      client: project.client_id
        ? (clientLookup.get(project.client_id) ?? null)
        : null,
    })
  )

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
          <p className='text-muted-foreground text-sm'>
            Review active projects with quick insight into timing and client.
          </p>
        </div>
      </AppShellHeader>
      <ProjectsSettingsTable
        projects={hydratedProjects}
        clients={(clients ?? []) as ClientRow[]}
        contractorUsers={[]}
        membersByProject={{}}
      />
    </>
  )
}
