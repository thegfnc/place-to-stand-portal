import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ProjectsBoard } from './projects-board'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

export default async function ProjectsPage() {
  const user = await requireUser()
  const [projects, admins] = await Promise.all([
    fetchProjectsWithRelations(),
    fetchAdminUsers(),
  ])

  const sortableProjects = [...projects]

  const clients = sortableProjects
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

  const defaultProject = sortableProjects.find(project => {
    if (!project.slug) {
      return false
    }

    if (!project.client_id) {
      return false
    }

    const clientSlug =
      project.client?.slug ?? clientSlugById.get(project.client_id) ?? null

    return Boolean(clientSlug)
  })

  if (defaultProject) {
    const clientSlug =
      defaultProject.client?.slug ??
      (defaultProject.client_id
        ? (clientSlugById.get(defaultProject.client_id) ?? null)
        : null)

    if (clientSlug) {
      redirect(`/projects/${clientSlug}/${defaultProject.slug}/board`)
    }
  }

  return (
    <ProjectsBoard
      projects={sortableProjects}
      clients={clients}
      currentUserId={user.id}
      currentUserRole={user.role}
      admins={admins}
      activeClientId={null}
      activeProjectId={null}
      activeTaskId={null}
    />
  )
}
