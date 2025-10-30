import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { UserRole } from '@/lib/auth/session'

import { BOARD_COLUMNS, type BoardColumnId } from './board-constants'
import {
  createClientSlugLookup,
  createProjectLookup,
  createProjectsByClientLookup,
  groupTasksByColumn,
} from './board-utils'
import { useBoardDnDState } from './state/use-board-dnd'
import { useBoardNavigation } from './state/use-board-navigation'
import { useBoardSelectionState } from './state/use-board-selection'
import { useBoardSheetState } from './state/use-board-sheet-state'
import { useBoardTaskCollections } from './state/use-board-task-collections'

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

type MemberDirectoryEntry = { name: string }

type ProjectsBoardState = {
  isPending: boolean
  feedback: string | null
  selectedClientId: string | null
  selectedProjectId: string | null
  filteredProjects: ProjectWithRelations[]
  clientItems: Array<{ value: string; label: string; keywords: string[] }>
  projectItems: Array<{ value: string; label: string; keywords: string[] }>
  activeProject: ProjectWithRelations | null
  activeProjectTasks: TaskWithRelations[]
  canManageTasks: boolean
  memberDirectory: Map<string, MemberDirectoryEntry>
  tasksByColumn: Map<string, TaskWithRelations[]>
  draggingTask: TaskWithRelations | null
  addTaskDisabled: boolean
  addTaskDisabledReason: string | null
  isSheetOpen: boolean
  sheetTask: TaskWithRelations | undefined
  scrimLocked: boolean
  handleClientSelect: (clientId: string) => void
  handleProjectSelect: (projectId: string | null) => void
  handleDragStart: ReturnType<typeof useBoardDnDState>['handleDragStart']
  handleDragEnd: ReturnType<typeof useBoardDnDState>['handleDragEnd']
  openCreateSheet: ReturnType<typeof useBoardSheetState>['openCreateSheet']
  handleEditTask: ReturnType<typeof useBoardSheetState>['handleEditTask']
  handleSheetOpenChange: ReturnType<
    typeof useBoardSheetState
  >['handleSheetOpenChange']
  defaultTaskStatus: BoardColumnId
}

export const useProjectsBoardState = ({
  projects,
  clients,
  currentUserId,
  currentUserRole,
  admins,
  activeClientId,
  activeProjectId,
  activeTaskId,
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
    handleClientSelect,
    handleProjectSelect,
  } = useBoardSelectionState({
    projects,
    clients,
    projectsByClientId,
    activeClientId,
    activeProjectId,
    startTransition,
    navigateToProject,
    setFeedback,
  })

  const { tasksByProject, setTasksByProject } = useBoardTaskCollections({
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

  const canManageTasks = useMemo(() => {
    if (!activeProject) return false
    if (currentUserRole === 'ADMIN') return true

    return activeProject.members.some(
      member => member.user_id === currentUserId && member.role !== 'VIEWER'
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
  } = useBoardSheetState({
    projects,
    tasksByProject,
    selectedProjectId,
    activeProject,
    activeTaskId,
    navigateToProject,
    startTransition,
  })

  const { handleDragStart, handleDragEnd, draggingTask } = useBoardDnDState({
    canManageTasks,
    activeProject,
    tasksByProject,
    setTasksByProject,
    activeProjectTasks,
    startTransition,
    setFeedback,
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
    activeProject,
    activeProjectTasks,
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
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
  }
}
