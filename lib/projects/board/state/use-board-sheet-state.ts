import { useCallback, useEffect, useState } from 'react'
import type { TransitionStartFunction } from 'react'

import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import type { NavigateOptions, TaskLookup } from './types'

const findTaskAcrossProjects = (
  projects: ProjectWithRelations[],
  taskId: string | null
) => {
  if (!taskId) return undefined

  for (const project of projects) {
    const match = project.tasks.find(task => task.id === taskId)
    if (match) {
      return match
    }
  }

  return undefined
}

type UseBoardSheetStateArgs = {
  projects: ProjectWithRelations[]
  tasksByProject: TaskLookup
  selectedProjectId: string | null
  activeProject: ProjectWithRelations | null
  activeTaskId: string | null
  navigateToProject: (
    projectId: string | null,
    options?: NavigateOptions
  ) => void
  startTransition: TransitionStartFunction
  currentView: 'board' | 'calendar' | 'activity' | 'refine' | 'review'
}

export const useBoardSheetState = ({
  projects,
  tasksByProject,
  selectedProjectId,
  activeProject,
  activeTaskId,
  navigateToProject,
  startTransition,
  currentView,
}: UseBoardSheetStateArgs) => {
  const [isSheetOpen, setIsSheetOpen] = useState(() => Boolean(activeTaskId))
  const [sheetTask, setSheetTask] = useState<TaskWithRelations | undefined>(
    () => findTaskAcrossProjects(projects, activeTaskId)
  )
  const [routeTaskId, setRouteTaskId] = useState<string | null>(activeTaskId)
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [scrimLocked, setScrimLocked] = useState(false)
  const [defaultTaskStatus, setDefaultTaskStatus] =
    useState<BoardColumnId>('BACKLOG')
  const [defaultTaskDueOn, setDefaultTaskDueOn] = useState<string | null>(null)

  useEffect(() => {
    if (activeTaskId) {
      let nextTask: TaskWithRelations | null = null

      if (selectedProjectId) {
        const projectTasks = tasksByProject.get(selectedProjectId)
        const match = projectTasks?.find(
          (task: TaskWithRelations) => task.id === activeTaskId
        )
        if (match) {
          nextTask = match
        }
      }

      if (!nextTask) {
        nextTask = findTaskAcrossProjects(projects, activeTaskId) ?? null
      }

      startTransition(() => {
        setRouteTaskId(activeTaskId)
        setPendingTaskId(null)
        setDefaultTaskDueOn(null)
        if (nextTask) {
          setSheetTask(nextTask)
          setIsSheetOpen(true)
        }
      })
      return
    }

    if (pendingTaskId) {
      return
    }

    if (routeTaskId) {
      startTransition(() => {
        setRouteTaskId(null)
        setDefaultTaskDueOn(null)
        setSheetTask(prev =>
          prev && prev.id === routeTaskId ? undefined : prev
        )
        setIsSheetOpen(false)
      })
    }
  }, [
    activeTaskId,
    pendingTaskId,
    projects,
    routeTaskId,
    selectedProjectId,
    startTransition,
    tasksByProject,
  ])

  const openCreateSheet = useCallback(
    (status?: BoardColumnId, options?: { dueOn?: string | null }) => {
      const targetProjectId = selectedProjectId ?? activeProject?.id ?? null
      setDefaultTaskStatus(status ?? 'BACKLOG')
      setDefaultTaskDueOn(options?.dueOn ?? null)

      if (targetProjectId) {
        navigateToProject(targetProjectId, {
          taskId: null,
          replace: true,
          view: currentView,
        })
      } else {
        navigateToProject(null, { replace: true })
      }

      setRouteTaskId(null)
      setPendingTaskId(null)
      setSheetTask(undefined)
      setIsSheetOpen(true)
    },
    [activeProject?.id, currentView, navigateToProject, selectedProjectId]
  )

  const handleEditTask = useCallback(
    (task: TaskWithRelations) => {
      setScrimLocked(true)
      setRouteTaskId(task.id)
      setPendingTaskId(task.id)
      setDefaultTaskDueOn(null)
      navigateToProject(task.project_id, {
        taskId: task.id,
        view: currentView,
      })
    },
    [currentView, navigateToProject]
  )

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      setIsSheetOpen(open)
      if (!open) {
        const projectIdForSheet = sheetTask?.project_id ?? selectedProjectId
        setDefaultTaskStatus('BACKLOG')
        setDefaultTaskDueOn(null)

        if (routeTaskId && projectIdForSheet) {
          setScrimLocked(true)
          startTransition(() => {
            setRouteTaskId(null)
            setPendingTaskId(null)
            navigateToProject(projectIdForSheet, {
              taskId: null,
              replace: true,
              view: currentView,
            })
          })
        }

        setSheetTask(undefined)
      }
    },
    [
      currentView,
      navigateToProject,
      routeTaskId,
      selectedProjectId,
      sheetTask?.project_id,
      startTransition,
    ]
  )

  return {
    isSheetOpen,
    sheetTask,
    scrimLocked,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
    defaultTaskDueOn,
  }
}
