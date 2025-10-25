import type { Metadata } from 'next'

import { ProjectsSettingsTable } from './projects-table'
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
    { data: projectMembers, error: projectMembersError },
    { data: contractorUsers, error: contractorUsersError },
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
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase.from('clients').select('id, name, deleted_at').order('name'),
    supabase
      .from('project_members')
      .select(
        `
        project_id,
        user_id,
        deleted_at,
        user:users ( id, email, full_name, role, deleted_at )
      `
      )
      .is('deleted_at', null),
    supabase
      .from('users')
      .select('id, email, full_name, role, deleted_at')
      .eq('role', 'CONTRACTOR')
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .order('email', { ascending: true }),
  ])

  if (projectsError) {
    console.error('Failed to load projects for settings', projectsError)
  }

  if (clientsError) {
    console.error('Failed to load clients for project settings', clientsError)
  }

  if (projectMembersError) {
    console.error('Failed to load project memberships', projectMembersError)
  }

  if (contractorUsersError) {
    console.error('Failed to load contractor users', contractorUsersError)
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

  const contractorMembersByProject = (projectMembers ?? []).reduce(
    (acc, member) => {
      const user = member.user

      if (!user || user.deleted_at || user.role !== 'CONTRACTOR') {
        return acc
      }

      const list = acc[member.project_id] ?? []
      list.push({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      })
      acc[member.project_id] = list
      return acc
    },
    {} as Record<
      string,
      Array<{ id: string; email: string; fullName: string | null }>
    >
  )

  const contractorDirectory = (contractorUsers ?? [])
    .filter(user => !user.deleted_at)
    .map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
    }))

  return (
    <ProjectsSettingsTable
      projects={hydratedProjects}
      clients={(clients ?? []) as ClientRow[]}
      contractorUsers={contractorDirectory}
      membersByProject={contractorMembersByProject}
    />
  )
}
