import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { ProjectsBoard } from '../../../projects-board'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

type PageProps = {
  params: Promise<{
    clientSlug: string
    projectSlug: string
  }>
}

export default async function ProjectActivityRoute({ params }: PageProps) {
  const resolvedParams = await params
  const { clientSlug, projectSlug } = resolvedParams
  const user = await requireUser()
  const [projects, admins] = await Promise.all([
    fetchProjectsWithRelations({
      forUserId: user.id,
      forRole: user.role,
    }),
    fetchAdminUsers(),
  ])

  const clients = projects
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
    redirect(`/projects/${canonicalClientSlug}/${project.slug}/activity`)
  }

  const activeClientId = project.client_id ?? null
  const activeProjectId = project.id

  return (
    <ProjectsBoard
      projects={projects}
      clients={clients}
      currentUserId={user.id}
      currentUserRole={user.role}
      admins={admins}
      activeClientId={activeClientId}
      activeProjectId={activeProjectId}
      activeTaskId={null}
      initialTab='activity'
    />
  )
}
