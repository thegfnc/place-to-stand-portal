import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { ReactElement } from 'react'

import { ProjectsBoard } from '../../../projects-board'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireUser } from '@/lib/auth/session'

type ReviewRouteArgs = {
  clientSlug: string
  projectSlug: string
  taskId?: string | null
}

export const reviewMetadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

const buildClientList = (
  projects: Awaited<ReturnType<typeof fetchProjectsWithRelations>>
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
}: ReviewRouteArgs): Promise<ReactElement> => {
  const user = await requireUser()
  const [projects, admins] = await Promise.all([
    fetchProjectsWithRelations({
      forUserId: user.id,
      forRole: user.role,
    }),
    fetchAdminUsers(),
  ])

  const clients = buildClientList(projects)
  const clientSlugById = buildClientSlugLookup(clients)
  const project = projects.find(item => item.slug === projectSlug)

  if (!project) {
    redirect('/projects')
  }

  const canonicalClientSlug = project.client_id
    ? (project.client?.slug ?? clientSlugById.get(project.client_id) ?? null)
    : null

  if (!canonicalClientSlug) {
    redirect('/projects')
  }

  if (canonicalClientSlug !== clientSlug) {
    const suffix = taskId ? `/${taskId}` : ''
    redirect(`/projects/${canonicalClientSlug}/${project.slug}/review${suffix}`)
  }

  const activeClientId = project.client_id ?? null
  const activeProjectId = project.id
  const activeTaskId = taskId ?? null

  return (
    <ProjectsBoard
      projects={projects}
      clients={clients}
      currentUserId={user.id}
      currentUserRole={user.role}
      admins={admins}
      activeClientId={activeClientId}
      activeProjectId={activeProjectId}
      activeTaskId={activeTaskId}
      initialTab='review'
    />
  )
}
