import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'

import type { ProjectWithRelations } from '@/lib/types'

import { NO_CLIENT_PROJECTS_MESSAGE } from '../board-constants'
import type { NavigateOptions } from './types'

const resolveInitialClientId = (
  projects: ProjectWithRelations[],
  clients: Array<{ id: string }>,
  activeClientId: string | null,
  activeProjectId: string | null
) => {
  if (activeClientId) {
    return activeClientId
  }

  if (activeProjectId) {
    const match = projects.find(project => project.id === activeProjectId)
    if (match?.client_id) {
      return match.client_id
    }
  }

  const firstProjectWithClient = projects.find(project => project.client_id)
  if (firstProjectWithClient?.client_id) {
    return firstProjectWithClient.client_id
  }

  return clients[0]?.id ?? null
}

const resolveInitialProjectId = (
  projects: ProjectWithRelations[],
  activeProjectId: string | null
) => activeProjectId ?? projects[0]?.id ?? null

type BoardSelectionArgs = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  projectsByClientId: Map<string, ProjectWithRelations[]>
  activeClientId: string | null
  activeProjectId: string | null
  startTransition: TransitionStartFunction
  navigateToProject: (
    projectId: string | null,
    options?: NavigateOptions
  ) => void
  setFeedback: Dispatch<SetStateAction<string | null>>
  currentView: 'board' | 'calendar' | 'activity' | 'backlog' | 'review'
}

export const useBoardSelectionState = ({
  projects,
  clients,
  projectsByClientId,
  activeClientId,
  activeProjectId,
  startTransition,
  navigateToProject,
  setFeedback,
  currentView,
}: BoardSelectionArgs) => {
  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  )

  const [selectedClientId, setSelectedClientId] = useState<string | null>(() =>
    resolveInitialClientId(
      projects,
      sortedClients,
      activeClientId,
      activeProjectId
    )
  )
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => resolveInitialProjectId(projects, activeProjectId)
  )

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) {
      return [] as ProjectWithRelations[]
    }
    return projects
      .filter(project => project.client_id === selectedClientId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, selectedClientId])

  const projectSequence = useMemo(() => {
    const sequence: Array<{ clientId: string; projectId: string }> = []

    sortedClients.forEach(client => {
      const clientProjects = projects
        .filter(project => project.client_id === client.id)
        .sort((a, b) => a.name.localeCompare(b.name))

      clientProjects.forEach(project => {
        sequence.push({ clientId: client.id, projectId: project.id })
      })
    })

    return sequence
  }, [projects, sortedClients])

  const sequenceIndex = useMemo(() => {
    if (!selectedProjectId) {
      return -1
    }
    return projectSequence.findIndex(
      entry => entry.projectId === selectedProjectId
    )
  }, [projectSequence, selectedProjectId])

  const canSelectNextProject =
    sequenceIndex !== -1 && sequenceIndex < projectSequence.length - 1

  const canSelectPreviousProject = sequenceIndex > 0

  const clientItems = useMemo(
    () =>
      sortedClients.map(client => ({
        value: client.id,
        label: client.name,
        keywords: [client.name],
      })),
    [sortedClients]
  )

  const projectItems = useMemo(
    () =>
      filteredProjects.map(project => ({
        value: project.id,
        label: project.name,
        keywords: [project.name],
      })),
    [filteredProjects]
  )

  useEffect(() => {
    if (activeClientId && selectedClientId !== activeClientId) {
      startTransition(() => {
        setSelectedClientId(activeClientId)
      })
    }
  }, [activeClientId, selectedClientId, startTransition])

  useEffect(() => {
    if (activeProjectId && selectedProjectId !== activeProjectId) {
      startTransition(() => {
        setSelectedProjectId(activeProjectId)
      })
    }
  }, [activeProjectId, selectedProjectId, startTransition])

  useEffect(() => {
    if (selectedClientId && projectItems.length === 0) {
      startTransition(() => {
        setFeedback((prev: string | null) =>
          prev === NO_CLIENT_PROJECTS_MESSAGE
            ? prev
            : NO_CLIENT_PROJECTS_MESSAGE
        )
      })
      return
    }

    startTransition(() => {
      setFeedback((prev: string | null) =>
        prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev
      )
    })
  }, [projectItems.length, selectedClientId, setFeedback, startTransition])

  useEffect(() => {
    if (filteredProjects.length === 0) {
      startTransition(() => {
        setSelectedProjectId(null)
      })
      return
    }

    if (
      !selectedProjectId ||
      !filteredProjects.some(project => project.id === selectedProjectId)
    ) {
      const nextProjectId = filteredProjects[0]?.id ?? null
      startTransition(() => {
        setSelectedProjectId(nextProjectId)
        if (nextProjectId) {
          navigateToProject(nextProjectId, {
            replace: true,
            view: currentView,
          })
        }
      })
    }
  }, [
    currentView,
    filteredProjects,
    navigateToProject,
    selectedProjectId,
    startTransition,
  ])

  const handleClientSelect = useCallback(
    (clientId: string) => {
      startTransition(() => {
        setSelectedClientId(clientId)
      })

      const clientProjects = (projectsByClientId.get(clientId) ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))

      if (clientProjects.length === 0) {
        setFeedback((prev: string | null) =>
          prev === NO_CLIENT_PROJECTS_MESSAGE
            ? prev
            : NO_CLIENT_PROJECTS_MESSAGE
        )
        startTransition(() => {
          setSelectedProjectId(null)
        })
        return
      }

      setFeedback((prev: string | null) =>
        prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev
      )

      const currentSelectionStillValid = clientProjects.some(
        project => project.id === selectedProjectId
      )

      const nextProjectId = currentSelectionStillValid
        ? selectedProjectId
        : (clientProjects[0]?.id ?? null)

      startTransition(() => {
        setSelectedProjectId(nextProjectId)
      })

      if (nextProjectId) {
        navigateToProject(nextProjectId, {
          replace: true,
          view: currentView,
        })
      }
    },
    [
      currentView,
      navigateToProject,
      projectsByClientId,
      selectedProjectId,
      setFeedback,
      startTransition,
    ]
  )

  const handleProjectSelect = useCallback(
    (projectId: string | null) => {
      startTransition(() => {
        setSelectedProjectId(projectId)
      })

      if (!projectId) {
        navigateToProject(null)
        return
      }

      setFeedback((prev: string | null) =>
        prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev
      )
      navigateToProject(projectId, { view: currentView })
    },
    [currentView, navigateToProject, setFeedback, startTransition]
  )

  const selectAndNavigate = useCallback(
    (clientId: string, projectId: string) => {
      startTransition(() => {
        setSelectedClientId(clientId)
        setSelectedProjectId(projectId)
      })

      setFeedback((prev: string | null) =>
        prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev
      )

      navigateToProject(projectId, { view: currentView })
    },
    [currentView, navigateToProject, setFeedback, startTransition]
  )

  const handleSelectNextProject = useCallback(() => {
    if (!canSelectNextProject) {
      return
    }

    const currentIndex = sequenceIndex === -1 ? 0 : sequenceIndex + 1
    const next = projectSequence[currentIndex]
    if (!next) {
      return
    }

    selectAndNavigate(next.clientId, next.projectId)
  }, [canSelectNextProject, projectSequence, selectAndNavigate, sequenceIndex])

  const handleSelectPreviousProject = useCallback(() => {
    if (!canSelectPreviousProject) {
      return
    }

    const previousIndex = sequenceIndex - 1
    const previous = projectSequence[previousIndex]
    if (!previous) {
      return
    }

    selectAndNavigate(previous.clientId, previous.projectId)
  }, [
    canSelectPreviousProject,
    projectSequence,
    selectAndNavigate,
    sequenceIndex,
  ])

  return {
    selectedClientId,
    selectedProjectId,
    filteredProjects,
    clientItems,
    projectItems,
    handleClientSelect,
    handleProjectSelect,
    handleSelectNextProject,
    handleSelectPreviousProject,
    canSelectNextProject,
    canSelectPreviousProject,
  }
}
