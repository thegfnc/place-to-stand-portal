import type { Metadata } from 'next'

import { ProjectsSettingsTable } from './projects-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import {
  listProjectsForSettings,
  type ProjectsSettingsListItem,
  type ProjectsSettingsResult,
} from '@/lib/queries/projects'
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

type ProjectsSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function mapProjectToTableRow(project: ProjectsSettingsListItem): ProjectWithClient {
  return {
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
    client: project.client
      ? {
          id: project.client.id,
          name: project.client.name,
          deleted_at: project.client.deletedAt,
        }
      : null,
  }
}

export default async function ProjectsSettingsPage({
  searchParams,
}: ProjectsSettingsPageProps) {
  const admin = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const tabParamRaw = params.tab
  const tabParam =
    typeof tabParamRaw === 'string'
      ? tabParamRaw
      : Array.isArray(tabParamRaw)
        ? tabParamRaw[0]
        : 'projects'
  const tab: ProjectsTab =
    tabParam === 'archive'
      ? 'archive'
      : tabParam === 'activity'
        ? 'activity'
        : 'projects'

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

  const result: ProjectsSettingsResult = await listProjectsForSettings(admin, {
    status,
    search: searchQuery,
    cursor,
    direction,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
  })

  const clientRows: ClientRow[] = result.clients.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))

  const hydratedProjects: ProjectWithClient[] = result.items.map(
    mapProjectToTableRow
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
        clients={clientRows}
        contractorUsers={[]}
        membersByProject={{}}
        tab={tab}
        pageInfo={result.pageInfo}
        totalCount={result.totalCount}
      />
    </>
  )
}

type ProjectsTab = 'projects' | 'archive' | 'activity'
