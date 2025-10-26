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
}: BoardSelectionArgs) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() =>
    resolveInitialClientId(projects, clients, activeClientId, activeProjectId)
  )
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => resolveInitialProjectId(projects, activeProjectId)
  )

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) {
      return [] as ProjectWithRelations[]
    }
    return projects.filter(project => project.client_id === selectedClientId)
  }, [projects, selectedClientId])

  const clientItems = useMemo(
    () =>
      clients.map(client => ({
        value: client.id,
        label: client.name,
        keywords: [client.name],
      })),
    [clients]
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
          navigateToProject(nextProjectId, { replace: true })
        }
      })
    }
  }, [filteredProjects, navigateToProject, selectedProjectId, startTransition])

  const handleClientSelect = useCallback(
    (clientId: string) => {
      startTransition(() => {
        setSelectedClientId(clientId)
      })

      const clientProjects = projectsByClientId.get(clientId) ?? []

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
        navigateToProject(nextProjectId, { replace: true })
      }
    },
    [
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
      navigateToProject(projectId)
    },
    [navigateToProject, setFeedback, startTransition]
  )

  return {
    selectedClientId,
    selectedProjectId,
    filteredProjects,
    clientItems,
    projectItems,
    handleClientSelect,
    handleProjectSelect,
  }
}
