import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { ProjectsBoard } from '../../../../projects-board'
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
    taskId?: string[]
  }>
}

export default async function ProjectBoardRoute({ params }: PageProps) {
  const resolvedParams = await params
  const { clientSlug, projectSlug, taskId } = resolvedParams
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

  const requestedTaskPath = Array.isArray(taskId)
    ? taskId.filter(segment => Boolean(segment)).join('/')
    : ''

  if (!canonicalClientSlug) {
    redirect('/projects')
  }

  if (canonicalClientSlug !== clientSlug) {
    const suffix = requestedTaskPath ? `/${requestedTaskPath}` : ''
    redirect(`/projects/${canonicalClientSlug}/${project.slug}/board${suffix}`)
  }

  const activeClientId = project.client_id ?? null
  const activeProjectId = project.id
  const activeTaskId = Array.isArray(taskId) ? (taskId[0] ?? null) : null

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
    />
  )
}
