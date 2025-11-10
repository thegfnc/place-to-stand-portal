import type { Metadata } from 'next'

import { ProjectsSettingsTable } from './projects-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { getProjectsSettingsSnapshot } from '@/lib/queries/projects'
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
  const admin = await requireRole('ADMIN')
  const { projects, clients } = await getProjectsSettingsSnapshot(admin)

  const clientRows: ClientRow[] = clients.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))

  const clientLookup = new Map(
    clientRows.map(client => [client.id, client] as const)
  )

  const hydratedProjects: ProjectWithClient[] = projects.map(project => ({
    id: project.id,
    name: project.name,
    status: project.status,
    slug: project.slug,
    client_id: project.clientId,
    created_by: project.createdBy,
    starts_on: project.startsOn,
    ends_on: project.endsOn,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    deleted_at: project.deletedAt,
    client: project.clientId ? clientLookup.get(project.clientId) ?? null : null,
  }))

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
        clients={clientRows}
        contractorUsers={[]}
        membersByProject={{}}
      />
    </>
  )
}
