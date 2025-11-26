'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import {
  ProjectsBoardHeader,
  type BoardHeaderItem,
  type BoardHeaderItemGroup,
} from './projects-board-header'
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
  currentUserId: string
}

export function ProjectsLandingHeader({
  projects,
  clients,
  currentUserId,
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

  const { projectItems, projectGroups } = useMemo(() => {
    const grouped: Record<
      'client' | 'internal' | 'personal',
      BoardHeaderItem[]
    > = {
      client: [],
      internal: [],
      personal: [],
    }

    projects.forEach(project => {
      if (project.type === 'PERSONAL' && project.created_by !== currentUserId) {
        return
      }

      const destination =
        project.type === 'INTERNAL'
          ? 'internal'
          : project.type === 'PERSONAL'
            ? 'personal'
            : 'client'

      const clientName = project.client?.name ?? 'Unassigned'
      const labelPrefix =
        destination === 'client'
          ? clientName
          : destination === 'internal'
            ? 'Internal'
            : 'Personal'

      const item: BoardHeaderItem = {
        value: project.id,
        label: `${labelPrefix} / ${project.name}`,
        keywords: [clientName, project.name, labelPrefix],
      }

      grouped[destination].push(item)
    })

    const order = ['client', 'internal', 'personal'] as const

    const sectionLabels: Record<(typeof order)[number], string> = {
      client: 'Client Projects',
      internal: 'Internal Projects',
      personal: 'Personal Projects',
    }

    const sortedGroups: BoardHeaderItemGroup[] = order
      .map(key => {
        const items = grouped[key].sort((a, b) =>
          a.label.localeCompare(b.label)
        )
        return items.length > 0
          ? {
              label: sectionLabels[key],
              items,
            }
          : null
      })
      .filter((group): group is BoardHeaderItemGroup => Boolean(group))

    const flattenedItems = sortedGroups.flatMap(group => group.items)

    return {
      projectItems: flattenedItems,
      projectGroups: sortedGroups,
    }
  }, [projects, currentUserId])

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
      projectGroups={projectGroups}
      selectedProjectId={null}
      onProjectChange={handleProjectSelect}
      onSelectNextProject={handleSelectNextProject}
      onSelectPreviousProject={handleSelectPreviousProject}
      canSelectNext={false}
      canSelectPrevious={false}
    />
  )
}
