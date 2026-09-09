import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { ProjectsBoard } from '../../../projects-board'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireUser } from '@/lib/auth/session'
import { getProjectClientSegment } from '@/lib/projects/board/board-utils'
import { fetchClientDirectory } from '@/lib/queries/clients'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

type PageProps = {
  params: Promise<{
    clientSlug: string
    projectSlug: string
  }>
}

export default async function ProjectReviewRoute({ params }: PageProps) {
  const resolvedParams = await params
  const { clientSlug, projectSlug } = resolvedParams
  const user = await requireUser()
  const [liteProjects, admins, clientDirectory] = await Promise.all([
    fetchProjectsLite(),
    fetchAdminUsers(),
    fetchClientDirectory(),
  ])

  const allClients: ClientRow[] = clientDirectory.map(c => ({
    id: c.id,
    name: c.name,
    deleted_at: c.deletedAt,
  }))

  const clients = liteProjects
    .map(project => project.client)
    .filter((client): client is NonNullable<typeof client> => Boolean(client))
    .reduce(
      (acc, client) => {
        if (!acc.some(existing => existing.id === client.id)) {
          acc.push({ id: client.id, name: client.name, slug: client.slug })
        }
        return acc
      },
      [] as Array<{ id: string; name: string; slug: string | null }>
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const clientSlugById = new Map<string, string | null>(
    clients.map(client => [client.id, client.slug ?? null])
  )

  const adminUsers: AdminUserForOwner[] = admins.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
    disabled_at: admin.disabled_at ?? null,
  }))

  const project = liteProjects.find(item => item.slug === projectSlug)

  if (!project) {
    redirect('/projects')
  }

  const canonicalClientSlug = getProjectClientSegment(project, clientSlugById)

  if (!canonicalClientSlug) {
    redirect('/projects')
  }

  if (canonicalClientSlug !== clientSlug) {
    redirect(`/projects/${canonicalClientSlug}/${project.slug}/review`)
  }

  const activeClientId = project.client_id ?? null
  const activeProjectId = project.id

  const [hydratedProject] = await fetchProjectsWithRelationsByIds([
    project.id,
  ], {
    includeArchivedTasks: true,
  })
  const projects = liteProjects.map(item =>
    item.id === project.id && hydratedProject ? hydratedProject : item
  )

  return (
    <ProjectsBoard
      projects={projects}
      clients={clients}
      currentUserId={user.id}
      admins={admins}
      adminUsers={adminUsers}
      allClients={allClients}
      activeClientId={activeClientId}
      activeProjectId={activeProjectId}
      activeTaskId={null}
      initialTab='review'
    />
  )
}
