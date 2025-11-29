import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsLanding } from './_components/projects-landing'
import { ProjectsLandingAdminSection } from './_components/projects-landing-admin-section'
import { ProjectsLandingHeader } from './_components/projects-landing-header'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import {
  listProjectsForSettings,
  type ProjectsSettingsResult,
} from '@/lib/queries/projects'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { ProjectWithRelations } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

export default async function ProjectsPage() {
  const user = await requireUser()
  const projects = await fetchProjectsWithRelations({
    forUserId: user.id,
    forRole: user.role,
  })
  const landingClients = buildLandingClients(projects)

  if (!isAdmin(user)) {
    return renderProjectLanding({ user, projects, landingClients })
  }

  const managementResult: ProjectsSettingsResult = await listProjectsForSettings(
    user,
    {
      status: 'active',
      limit: 1,
    }
  )

  const clientRows: ClientRow[] = managementResult.clients.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))

  return (
    <>
      <AppShellHeader>
        <ProjectsLandingHeader
          projects={projects}
          clients={landingClients}
          currentUserId={user.id}
        />
      </AppShellHeader>
      <ProjectsLandingAdminSection
        projects={projects}
        landingClients={landingClients}
        clients={clientRows}
        currentUserId={user.id}
        totalProjectCount={managementResult.totalCount}
      />
    </>
  )
}

type LandingClient = { id: string; name: string; slug: string | null }

function renderProjectLanding({
  user,
  projects,
  landingClients,
}: {
  user: Awaited<ReturnType<typeof requireUser>>
  projects: ProjectWithRelations[]
  landingClients: LandingClient[]
}) {
  const sortableProjects = [...projects]

  return (
    <>
      <AppShellHeader>
        <ProjectsLandingHeader
          projects={sortableProjects}
          clients={landingClients}
          currentUserId={user.id}
        />
      </AppShellHeader>
      <div className='space-y-6'>
        <ProjectsLanding
          projects={sortableProjects}
          clients={landingClients}
          currentUserId={user.id}
        />
      </div>
    </>
  )
}

function buildLandingClients(projects: ProjectWithRelations[]): LandingClient[] {
  const map = new Map<string, LandingClient>()

  projects.forEach(project => {
    if (project.client) {
      map.set(project.client.id, {
        id: project.client.id,
        name: project.client.name,
        slug: project.client.slug,
      })
    }
  })

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}
