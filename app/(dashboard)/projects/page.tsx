import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsLanding } from './_components/projects-landing'
import { ProjectsLandingHeader } from './_components/projects-landing-header'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { requireUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

export default async function ProjectsPage() {
  const user = await requireUser()
  const projects = await fetchProjectsWithRelations({
    forUserId: user.id,
    forRole: user.role,
  })

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

  return (
    <>
      <AppShellHeader>
        <ProjectsLandingHeader
          projects={sortableProjects}
          clients={clients}
          currentUserId={user.id}
        />
      </AppShellHeader>
      <div className='space-y-6'>
        <ProjectsLanding
          projects={sortableProjects}
          clients={clients}
          currentUserId={user.id}
        />
      </div>
    </>
  )
}
