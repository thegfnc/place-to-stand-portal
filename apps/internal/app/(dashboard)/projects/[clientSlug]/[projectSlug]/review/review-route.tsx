import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { ReactElement } from 'react'

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

type ReviewRouteArgs = {
  clientSlug: string
  projectSlug: string
  taskId?: string | null
  /** Whole query string, carried across the canonical-slug redirect. */
  querySuffix?: string
}

export const reviewMetadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

const buildClientList = (
  projects: Awaited<ReturnType<typeof fetchProjectsLite>>
) =>
  projects
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

const buildClientSlugLookup = (
  clients: Array<{ id: string; slug: string | null }>
): Map<string, string | null> =>
  new Map(clients.map(client => [client.id, client.slug ?? null]))

export const renderReviewRoute = async ({
  clientSlug,
  projectSlug,
  taskId = null,
  querySuffix = '',
}: ReviewRouteArgs): Promise<ReactElement> => {
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

  const clients = buildClientList(liteProjects)
  const clientSlugById = buildClientSlugLookup(clients)

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
    // Carry the whole query string so a stacked sheet link survives it.
    redirect(
      `/projects/${canonicalClientSlug}/${project.slug}/review${querySuffix}`
    )
  }

  const activeClientId = project.client_id ?? null
  const activeProjectId = project.id
  const activeTaskId = taskId ?? null

  // The review tab renders archived tasks, so hydrate them here.
  const [hydratedProject] = await fetchProjectsWithRelationsByIds(
    [project.id],
    { includeArchivedTasks: true }
  )
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
      activeTaskId={activeTaskId}
      initialTab='review'
    />
  )
}
