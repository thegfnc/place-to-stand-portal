import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'

import type { ProjectWithRelations } from '@/lib/types'
import { buildProjectSelectionOptions } from '@/lib/projects/project-selection-utils'

import { NO_PROJECTS_MESSAGE } from '../board-constants'
import type { NavigateOptions } from './types'

const resolveInitialProjectId = (
  projects: ProjectWithRelations[],
  activeProjectId: string | null
) => activeProjectId ?? projects[0]?.id ?? null

type BoardSelectionArgs = {
  projects: ProjectWithRelations[]
  activeProjectId: string | null
  startTransition: TransitionStartFunction
  navigateToProject: (
    projectId: string | null,
    options?: NavigateOptions
  ) => void
  setFeedback: Dispatch<SetStateAction<string | null>>
  currentView: 'board' | 'calendar' | 'activity' | 'backlog' | 'review'
  currentUserId: string
}

export const useBoardSelectionState = ({
  projects,
  activeProjectId,
  startTransition,
  navigateToProject,
  setFeedback,
  currentView,
  currentUserId,
}: BoardSelectionArgs) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => resolveInitialProjectId(projects, activeProjectId)
  )

  const { items: projectItems, groups: projectGroups } = useMemo(
    () => buildProjectSelectionOptions({ projects, currentUserId }),
    [currentUserId, projects]
  )

  const projectSequence = useMemo(
    () => projectItems.map(item => item.value),
    [projectItems]
  )

  const sequenceIndex = useMemo(() => {
    if (!selectedProjectId) {
      return -1
    }
    return projectSequence.findIndex(
      projectId => projectId === selectedProjectId
    )
  }, [projectSequence, selectedProjectId])

  const canSelectNextProject =
    sequenceIndex !== -1 && sequenceIndex < projectSequence.length - 1

  const canSelectPreviousProject = sequenceIndex > 0

  useEffect(() => {
    if (activeProjectId && selectedProjectId !== activeProjectId) {
      startTransition(() => {
        setSelectedProjectId(activeProjectId)
      })
    }
  }, [activeProjectId, selectedProjectId, startTransition])

  useEffect(() => {
    if (projectItems.length === 0) {
      startTransition(() => {
        setSelectedProjectId(null)
      })

      setFeedback((prev: string | null) =>
        prev === NO_PROJECTS_MESSAGE ? prev : NO_PROJECTS_MESSAGE
      )
      return
    }

    setFeedback((prev: string | null) =>
      prev === NO_PROJECTS_MESSAGE ? null : prev
    )

    if (
      !selectedProjectId ||
      !projectSequence.some(projectId => projectId === selectedProjectId)
    ) {
      const nextProjectId = projectSequence[0] ?? null
      startTransition(() => {
        setSelectedProjectId(nextProjectId)
      })
      if (nextProjectId) {
        navigateToProject(nextProjectId, {
          replace: true,
          view: currentView,
        })
      }
    }
  }, [
    currentView,
    navigateToProject,
    projectItems.length,
    projectSequence,
    selectedProjectId,
    setFeedback,
    startTransition,
  ])

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
        prev === NO_PROJECTS_MESSAGE ? null : prev
      )
      navigateToProject(projectId, { view: currentView })
    },
    [currentView, navigateToProject, setFeedback, startTransition]
  )

  const selectAndNavigate = useCallback(
    (projectId: string) => {
      startTransition(() => {
        setSelectedProjectId(projectId)
      })
      setFeedback((prev: string | null) =>
        prev === NO_PROJECTS_MESSAGE ? null : prev
      )
      navigateToProject(projectId, { view: currentView })
    },
    [currentView, navigateToProject, setFeedback, startTransition]
  )

  const handleSelectNextProject = useCallback(() => {
    if (!canSelectNextProject) {
      return
    }

    const nextIndex = sequenceIndex === -1 ? 0 : sequenceIndex + 1
    const nextProjectId = projectSequence[nextIndex]
    if (!nextProjectId) {
      return
    }

    selectAndNavigate(nextProjectId)
  }, [canSelectNextProject, projectSequence, selectAndNavigate, sequenceIndex])

  const handleSelectPreviousProject = useCallback(() => {
    if (!canSelectPreviousProject) {
      return
    }

    const previousIndex = sequenceIndex - 1
    const previousProjectId = projectSequence[previousIndex]
    if (!previousProjectId) {
      return
    }

    selectAndNavigate(previousProjectId)
  }, [
    canSelectPreviousProject,
    projectSequence,
    selectAndNavigate,
    sequenceIndex,
  ])

  return {
    selectedProjectId,
    projectItems,
    projectGroups,
    handleProjectSelect,
    handleSelectNextProject,
    handleSelectPreviousProject,
    canSelectNextProject,
    canSelectPreviousProject,
  }
}
