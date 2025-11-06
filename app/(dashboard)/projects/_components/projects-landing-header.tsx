'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import { ProjectsBoardHeader } from './projects-board-header'
import { useBoardNavigation } from '@/lib/projects/board/state/use-board-navigation'
import { createProjectLookup, createProjectsByClientLookup, createClientSlugLookup } from '@/lib/projects/board/board-utils'
import type { ProjectWithRelations } from '@/lib/types'

type ProjectsLandingHeaderProps = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
}

export function ProjectsLandingHeader({
  projects,
  clients,
}: ProjectsLandingHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const projectLookup = useMemo(() => createProjectLookup(projects), [projects])
  const projectsByClientId = useMemo(
    () => createProjectsByClientLookup(projects),
    [projects]
  )
  const clientSlugLookup = useMemo(
    () => createClientSlugLookup(clients),
    [clients]
  )

  const navigateToProject = useBoardNavigation({
    router,
    pathname,
    projectLookup,
    projectsByClientId,
    clientSlugLookup,
    setFeedback: () => {},
  })

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  )

  const clientItems = useMemo(
    () =>
      sortedClients.map(client => ({
        value: client.id,
        label: client.name,
        keywords: [client.name],
      })),
    [sortedClients]
  )

  const projectItems = useMemo(() => {
    // When on landing page, show all projects
    return projects
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(project => ({
        value: project.id,
        label: project.name,
        keywords: [project.name],
      }))
  }, [projects])

  const handleClientSelect = (clientId: string) => {
    const clientProjects = (projectsByClientId.get(clientId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))

    if (clientProjects.length > 0) {
      const firstProject = clientProjects[0]
      if (firstProject) {
        navigateToProject(firstProject.id, { view: 'board' })
      }
    }
  }

  const handleProjectSelect = (projectId: string | null) => {
    if (!projectId) {
      return
    }
    navigateToProject(projectId, { view: 'board' })
  }

  const handleSelectNextProject = () => {
    // Not applicable on landing page
  }

  const handleSelectPreviousProject = () => {
    // Not applicable on landing page
  }

  return (
    <ProjectsBoardHeader
      clientItems={clientItems}
      projectItems={projectItems}
      selectedClientId={null}
      selectedProjectId={null}
      onClientChange={handleClientSelect}
      onProjectChange={handleProjectSelect}
      onSelectNextProject={handleSelectNextProject}
      onSelectPreviousProject={handleSelectPreviousProject}
      canSelectNext={false}
      canSelectPrevious={false}
    />
  )
}

