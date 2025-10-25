import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { UserRole } from '@/lib/auth/session'

import { changeTaskStatus } from '@/app/(dashboard)/projects/actions'

import {
  BOARD_BASE_PATH,
  BOARD_COLUMNS,
  MISSING_SLUG_MESSAGE,
  NO_CLIENT_PROJECTS_MESSAGE,
  type BoardColumnId,
} from './board-constants'
import {
  areTaskCollectionsEqual,
  buildBoardPath,
  createClientSlugLookup,
  createProjectLookup,
  createProjectsByClientLookup,
  groupTasksByColumn,
} from './board-utils'

export type UseProjectsBoardStateArgs = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  currentUserId: string
  currentUserRole: UserRole
  admins: DbUser[]
  activeClientId: string | null
  activeProjectId: string | null
  activeTaskId: string | null
}

type TaskLookup = Map<string, TaskWithRelations[]>

type NavigateOptions = { taskId?: string | null; replace?: boolean }

export const useProjectsBoardState = ({
  projects,
  clients,
  currentUserId,
  currentUserRole,
  admins,
  activeClientId,
  activeProjectId,
  activeTaskId,
}: UseProjectsBoardStateArgs) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    () => {
      if (activeClientId) {
        return activeClientId
      }

      if (activeProjectId) {
        const project = projects.find(item => item.id === activeProjectId)
        if (project?.client_id) {
          return project.client_id
        }
      }

      const firstProjectClientId = projects.find(
        item => item.client_id
      )?.client_id
      if (firstProjectClientId) {
        return firstProjectClientId
      }

      return clients[0]?.id ?? null
    }
  )
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => activeProjectId ?? projects[0]?.id ?? null
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(() => Boolean(activeTaskId))
  const [sheetTask, setSheetTask] = useState<TaskWithRelations | undefined>(
    () => {
      if (!activeTaskId) {
        return undefined
      }

      for (const project of projects) {
        const match = project.tasks.find(task => task.id === activeTaskId)
        if (match) {
          return match
        }
      }

      return undefined
    }
  )
  const [routeTaskId, setRouteTaskId] = useState<string | null>(activeTaskId)
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [scrimLocked, setScrimLocked] = useState(false)
  const [tasksByProject, setTasksByProject] = useState<TaskLookup>(() => {
    const map = new Map<string, TaskWithRelations[]>()
    projects.forEach(project => {
      map.set(project.id, project.tasks)
    })
    return map
  })

  const projectLookup = useMemo(() => createProjectLookup(projects), [projects])
  const projectsByClientId = useMemo(
    () => createProjectsByClientLookup(projects),
    [projects]
  )
  const clientSlugLookup = useMemo(
    () => createClientSlugLookup(clients),
    [clients]
  )

  const navigateToProject = useCallback(
    (projectId: string | null, options: NavigateOptions = {}) => {
      const { taskId = null, replace = false } = options

      if (!projectId) {
        if (pathname !== BOARD_BASE_PATH) {
          const redirect = replace ? router.replace : router.push
          redirect.call(router, BOARD_BASE_PATH, { scroll: false })
        }
        return
      }

      const path = buildBoardPath(
        projectId,
        {
          projectLookup,
          projectsByClientId,
          clientSlugLookup,
        },
        taskId
      )

      if (!path) {
        setFeedback(prev =>
          prev === MISSING_SLUG_MESSAGE ? prev : MISSING_SLUG_MESSAGE
        )
        return
      }

      setFeedback(prev => (prev === MISSING_SLUG_MESSAGE ? null : prev))

      if (pathname === path) {
        return
      }

      const redirect = replace ? router.replace : router.push
      redirect.call(router, path, { scroll: false })
    },
    [clientSlugLookup, pathname, projectLookup, projectsByClientId, router]
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
        setFeedback(prev =>
          prev === NO_CLIENT_PROJECTS_MESSAGE
            ? prev
            : NO_CLIENT_PROJECTS_MESSAGE
        )
      })
      return
    }

    startTransition(() => {
      setFeedback(prev => (prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev))
    })
  }, [projectItems.length, selectedClientId, startTransition])

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

  useEffect(() => {
    startTransition(() => {
      setTasksByProject(prev => {
        let didChange = false
        const next = new Map(prev)
        const incomingProjectIds = new Set<string>()

        projects.forEach(project => {
          incomingProjectIds.add(project.id)
          const existing = next.get(project.id)
          if (!areTaskCollectionsEqual(existing, project.tasks)) {
            next.set(project.id, project.tasks)
            didChange = true
          }
        })

        for (const projectId of next.keys()) {
          if (!incomingProjectIds.has(projectId)) {
            next.delete(projectId)
            didChange = true
          }
        }

        return didChange ? next : prev
      })
    })
  }, [projects, startTransition])

  useEffect(() => {
    if (activeTaskId) {
      const nextTask =
        (selectedProjectId
          ? tasksByProject.get(selectedProjectId)
          : projects.find(project => project.id === selectedProjectId)?.tasks
        )?.find(task => task.id === activeTaskId) ?? null

      startTransition(() => {
        setRouteTaskId(activeTaskId)
        setPendingTaskId(null)
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
        setSheetTask(prev =>
          prev && prev.id === routeTaskId ? undefined : prev
        )
        setIsSheetOpen(false)
      })
    }
  }, [
    activeTaskId,
    pendingTaskId,
    routeTaskId,
    selectedProjectId,
    startTransition,
    tasksByProject,
    projects,
  ])

  const activeProject = useMemo(() => {
    return (
      filteredProjects.find(project => project.id === selectedProjectId) ?? null
    )
  }, [filteredProjects, selectedProjectId])

  const activeProjectTasks = useMemo(() => {
    if (!activeProject) return [] as TaskWithRelations[]
    return tasksByProject.get(activeProject.id) ?? activeProject.tasks
  }, [activeProject, tasksByProject])

  const canManageTasks = useMemo(() => {
    if (!activeProject) return false
    if (currentUserRole === 'ADMIN') return true

    return activeProject.members.some(
      member => member.user_id === currentUserId && member.role !== 'VIEWER'
    )
  }, [activeProject, currentUserId, currentUserRole])

  const memberDirectory = useMemo(() => {
    const directory = new Map<string, { name: string }>()

    if (activeProject) {
      activeProject.members.forEach(member => {
        directory.set(member.user_id, {
          name: member.user.full_name ?? member.user.email,
        })
      })
    }

    admins.forEach(admin => {
      if (!directory.has(admin.id)) {
        directory.set(admin.id, {
          name: admin.full_name ?? admin.email,
        })
      }
    })

    return directory
  }, [activeProject, admins])

  const tasksByColumn = useMemo(
    () => groupTasksByColumn(activeProjectTasks, BOARD_COLUMNS),
    [activeProjectTasks]
  )

  const handleClientSelect = useCallback(
    (clientId: string) => {
      startTransition(() => {
        setSelectedClientId(clientId)
      })

      const clientProjects = projectsByClientId.get(clientId) ?? []

      if (clientProjects.length === 0) {
        setFeedback(prev =>
          prev === NO_CLIENT_PROJECTS_MESSAGE
            ? prev
            : NO_CLIENT_PROJECTS_MESSAGE
        )
        startTransition(() => {
          setSelectedProjectId(null)
        })
        return
      }

      setFeedback(prev => (prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev))

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
    [navigateToProject, projectsByClientId, selectedProjectId, startTransition]
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

      setFeedback(prev => (prev === NO_CLIENT_PROJECTS_MESSAGE ? null : prev))
      navigateToProject(projectId)
    },
    [navigateToProject, startTransition]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = String(event.active.id)
    setDragTaskId(taskId)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragTaskId(null)

      if (!canManageTasks || !activeProject) {
        return
      }

      const { active, over } = event

      if (!over) {
        return
      }

      const destinationStatus = over.id as BoardColumnId
      const activeData = active.data.current as
        | { type: string; taskId: string; projectId: string }
        | undefined

      if (!activeData || activeData.type !== 'task') {
        return
      }

      const { taskId, projectId } = activeData
      const projectTasks = tasksByProject.get(projectId)
      const task = projectTasks?.find(item => item.id === taskId)

      if (!task || task.status === destinationStatus) {
        return
      }

      const previousStatus = task.status as BoardColumnId

      setFeedback(null)
      setTasksByProject(prev => {
        const currentProjectTasks = prev.get(projectId)
        if (!currentProjectTasks) {
          return prev
        }

        const updatedProjectTasks = currentProjectTasks.map(item =>
          item.id === taskId ? { ...item, status: destinationStatus } : item
        )

        const next = new Map(prev)
        next.set(projectId, updatedProjectTasks)
        return next
      })

      startTransition(async () => {
        const result = await changeTaskStatus({
          taskId,
          status: destinationStatus,
        })

        if (result.error) {
          setFeedback(result.error)
          setTasksByProject(prev => {
            const currentProjectTasks = prev.get(projectId)
            if (!currentProjectTasks) {
              return prev
            }

            const revertedProjectTasks = currentProjectTasks.map(item =>
              item.id === taskId ? { ...item, status: previousStatus } : item
            )

            const next = new Map(prev)
            next.set(projectId, revertedProjectTasks)
            return next
          })
        }
      })
    },
    [activeProject, canManageTasks, startTransition, tasksByProject]
  )

  const openCreateSheet = useCallback(() => {
    const targetProjectId = selectedProjectId ?? activeProject?.id ?? null

    if (targetProjectId) {
      navigateToProject(targetProjectId, { taskId: null, replace: true })
    } else {
      navigateToProject(null, { replace: true })
    }

    setRouteTaskId(null)
    setPendingTaskId(null)
    setSheetTask(undefined)
    setIsSheetOpen(true)
  }, [activeProject?.id, navigateToProject, selectedProjectId])

  const handleEditTask = useCallback(
    (task: TaskWithRelations) => {
      setScrimLocked(true)
      setRouteTaskId(task.id)
      setPendingTaskId(task.id)
      navigateToProject(task.project_id, { taskId: task.id })
    },
    [navigateToProject]
  )

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      setIsSheetOpen(open)
      if (!open) {
        const projectIdForSheet = sheetTask?.project_id ?? selectedProjectId

        if (routeTaskId && projectIdForSheet) {
          setScrimLocked(true)
          startTransition(() => {
            setRouteTaskId(null)
            setPendingTaskId(null)
            navigateToProject(projectIdForSheet, {
              taskId: null,
              replace: true,
            })
          })
        }

        setSheetTask(undefined)
      }
    },
    [navigateToProject, routeTaskId, selectedProjectId, sheetTask?.project_id]
  )

  const draggingTask = useMemo(() => {
    if (!dragTaskId) return null
    return activeProjectTasks.find(task => task.id === dragTaskId) ?? null
  }, [activeProjectTasks, dragTaskId])

  const addTaskDisabled = !activeProject || !canManageTasks
  const addTaskDisabledReason = !activeProject
    ? 'Select a project to add tasks.'
    : !canManageTasks
      ? 'You need manage permissions to add tasks.'
      : null

  return {
    // Derived state
    isPending,
    feedback,
    selectedClientId,
    selectedProjectId,
    filteredProjects,
    clientItems,
    projectItems,
    activeProject,
    activeProjectTasks,
    canManageTasks,
    memberDirectory,
    tasksByColumn,
    draggingTask,
    addTaskDisabled,
    addTaskDisabledReason,
    // Sheet state
    isSheetOpen,
    sheetTask,
    scrimLocked,
    // Handlers
    handleClientSelect,
    handleProjectSelect,
    handleDragStart,
    handleDragEnd,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    setFeedback,
  }
}
