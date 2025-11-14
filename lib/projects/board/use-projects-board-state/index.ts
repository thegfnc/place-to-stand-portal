import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import type { TaskWithRelations } from '@/lib/types'

import { BOARD_COLUMNS } from '../board-constants'
import {
  createClientSlugLookup,
  createProjectLookup,
  createProjectsByClientLookup,
  groupTasksByColumn,
} from '../board-utils'
import { useCalendarDnDState } from '../../calendar/state/use-calendar-dnd-state'
import { useBoardDnDState } from '../state/use-board-dnd'
import { useBoardNavigation } from '../state/use-board-navigation'
import { useBoardSelectionState } from '../state/use-board-selection'
import { useBoardSheetState } from '../state/use-board-sheet-state'
import { useBoardTaskCollections } from '../state/use-board-task-collections'

import type {
  MemberDirectoryEntry,
  ProjectsBoardState,
  UseProjectsBoardStateArgs,
} from './types'

export const useProjectsBoardState = ({
  projects,
  clients,
  currentUserId,
  currentUserRole,
  admins,
  activeClientId,
  activeProjectId,
  activeTaskId,
  currentView,
}: UseProjectsBoardStateArgs): ProjectsBoardState => {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

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
    setFeedback,
  })

  const {
    selectedClientId,
    selectedProjectId,
    filteredProjects,
    clientItems,
    projectItems,
    canSelectNextProject,
    canSelectPreviousProject,
    handleClientSelect,
    handleProjectSelect,
    handleSelectNextProject,
    handleSelectPreviousProject,
  } = useBoardSelectionState({
    projects,
    clients,
    projectsByClientId,
    activeClientId,
    activeProjectId,
    startTransition,
    navigateToProject,
    setFeedback,
    currentView,
  })

  const {
    tasksByProject,
    setTasksByProject,
    archivedTasksByProject,
    setArchivedTasksByProject,
    acceptedTasksByProject,
    setAcceptedTasksByProject,
  } = useBoardTaskCollections({
    projects,
    startTransition,
  })

  const activeProject = useMemo(() => {
    return (
      filteredProjects.find(project => project.id === selectedProjectId) ?? null
    )
  }, [filteredProjects, selectedProjectId])

  const activeProjectTasks = useMemo(() => {
    if (!activeProject) {
      return [] as TaskWithRelations[]
    }
    return tasksByProject.get(activeProject.id) ?? activeProject.tasks
  }, [activeProject, tasksByProject])

  const activeProjectArchivedTasks = useMemo(() => {
    if (!activeProject) {
      return [] as TaskWithRelations[]
    }

    return (
      archivedTasksByProject.get(activeProject.id) ??
      activeProject.archivedTasks
    )
  }, [activeProject, archivedTasksByProject])

  const activeProjectAcceptedTasks = useMemo(() => {
    if (!activeProject) {
      return [] as TaskWithRelations[]
    }

    return (
      acceptedTasksByProject.get(activeProject.id) ??
      activeProject.acceptedTasks
    )
  }, [acceptedTasksByProject, activeProject])

  const canManageTasks = useMemo(() => {
    if (!activeProject) return false
    if (currentUserRole === 'ADMIN') return true

    return activeProject.members.some(
      member => member.user_id === currentUserId
    )
  }, [activeProject, currentUserId, currentUserRole])

  const memberDirectory = useMemo(() => {
    const directory = new Map<string, MemberDirectoryEntry>()

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

  const {
    isSheetOpen,
    sheetTask,
    scrimLocked,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
    defaultTaskDueOn,
  } = useBoardSheetState({
    projects,
    tasksByProject,
    selectedProjectId,
    activeProject,
    activeTaskId,
    navigateToProject,
    startTransition,
    currentView,
  })

  const {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    draggingTask,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
  } = useBoardDnDState({
    canManageTasks,
    activeProject,
    tasksByProject,
    setTasksByProject,
    activeProjectTasks,
    startTransition,
    setFeedback,
  })

  const {
    handleDragStart: handleCalendarDragStart,
    handleDragEnd: handleCalendarDragEnd,
    draggingTask: calendarDraggingTask,
  } = useCalendarDnDState({
    canManageTasks,
    tasksByProject,
    setTasksByProject,
    startTransition,
    setFeedback,
    activeProjectTasks,
  })

  const addTaskDisabled = !activeProject || !canManageTasks
  const addTaskDisabledReason = !activeProject
    ? 'Select a project to add tasks.'
    : !canManageTasks
      ? 'You need manage permissions to add tasks.'
      : null

  return {
    isPending,
    feedback,
    selectedClientId,
    selectedProjectId,
    filteredProjects,
    clientItems,
    projectItems,
    canSelectNextProject,
    canSelectPreviousProject,
    activeProject,
    activeProjectTasks,
    activeProjectArchivedTasks,
    activeProjectAcceptedTasks,
    canManageTasks,
    memberDirectory,
    tasksByColumn,
    draggingTask,
    addTaskDisabled,
    addTaskDisabledReason,
    isSheetOpen,
    sheetTask,
    scrimLocked,
    handleClientSelect,
    handleProjectSelect,
    handleDragStart,
    handleDragEnd,
    handleCalendarDragStart,
    handleCalendarDragEnd,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
    defaultTaskDueOn,
    calendarDraggingTask,
    navigateToProject,
    handleDragOver,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
    handleSelectNextProject,
    handleSelectPreviousProject,
  }
}
