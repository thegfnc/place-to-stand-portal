'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import { ProjectsBoardHeader } from './projects-board-header'
import { useBoardNavigation } from '@/lib/projects/board/state/use-board-navigation'
import {
  createProjectLookup,
  createProjectsByClientLookup,
  createClientSlugLookup,
} from '@/lib/projects/board/board-utils'
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

  const projectItems = useMemo(() => {
    return [...projects]
      .map(project => {
        const clientName = project.client?.name ?? 'Unassigned'
        return {
          value: project.id,
          label: `${clientName} / ${project.name}`,
          keywords: [clientName, project.name],
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [projects])

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
      projectItems={projectItems}
      selectedProjectId={null}
      onProjectChange={handleProjectSelect}
      onSelectNextProject={handleSelectNextProject}
      onSelectPreviousProject={handleSelectPreviousProject}
      canSelectNext={false}
      canSelectPrevious={false}
    />
  )
}

