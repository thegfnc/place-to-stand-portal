import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
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
import { useCalendarDnDState } from '../calendar/state/use-calendar-dnd-state'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { normalizeRawTask } from '@/lib/data/projects/normalize-task'
import type { RawTaskWithRelations } from '@/lib/data/projects/types'

export type UseProjectsBoardStateArgs = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  currentUserId: string
  currentUserRole: UserRole
  admins: DbUser[]
  activeClientId: string | null
  activeProjectId: string | null
  activeTaskId: string | null
  currentView: 'board' | 'calendar' | 'activity' | 'refine' | 'review'
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
  activeProjectArchivedTasks: TaskWithRelations[]
  canManageTasks: boolean
  memberDirectory: Map<string, MemberDirectoryEntry>
  tasksByColumn: Map<string, TaskWithRelations[]>
  draggingTask: TaskWithRelations | null
  calendarDraggingTask: TaskWithRelations | null
  addTaskDisabled: boolean
  addTaskDisabledReason: string | null
  isSheetOpen: boolean
  sheetTask: TaskWithRelations | undefined
  scrimLocked: boolean
  handleClientSelect: (clientId: string) => void
  handleProjectSelect: (projectId: string | null) => void
  handleDragStart: ReturnType<typeof useBoardDnDState>['handleDragStart']
  handleDragEnd: ReturnType<typeof useBoardDnDState>['handleDragEnd']
  handleCalendarDragStart: ReturnType<
    typeof useCalendarDnDState
  >['handleDragStart']
  handleCalendarDragEnd: ReturnType<typeof useCalendarDnDState>['handleDragEnd']
  openCreateSheet: ReturnType<typeof useBoardSheetState>['openCreateSheet']
  handleEditTask: ReturnType<typeof useBoardSheetState>['handleEditTask']
  handleSheetOpenChange: ReturnType<
    typeof useBoardSheetState
  >['handleSheetOpenChange']
  defaultTaskStatus: BoardColumnId
  defaultTaskDueOn: string | null
  navigateToProject: ReturnType<typeof useBoardNavigation>
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
    currentView,
  })

  const {
    tasksByProject,
    setTasksByProject,
    archivedTasksByProject,
    setArchivedTasksByProject,
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

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const trackedProjectIds = useMemo(() => {
    const ids = projects.map(project => project.id).filter(Boolean)
    ids.sort()
    return ids
  }, [projects])

  const trackedProjectIdsSet = useMemo(
    () => new Set(trackedProjectIds),
    [trackedProjectIds]
  )

  const refreshQueueRef = useRef(new Set<string>())
  const refreshTimerRef = useRef<number | null>(null)
  const refreshInFlightRef = useRef(new Set<string>())

  const refreshProjectTasks = useCallback(
    async (projectId: string) => {
      if (!trackedProjectIdsSet.has(projectId)) {
        return
      }

      if (refreshInFlightRef.current.has(projectId)) {
        return
      }

      refreshInFlightRef.current.add(projectId)

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select(
            `
            id,
            project_id,
            title,
            description,
            status,
            accepted_at,
            due_on,
            created_by,
            updated_by,
            created_at,
            updated_at,
            deleted_at,
            assignees:task_assignees (
              user_id,
              deleted_at
            ),
            comments:task_comments (
              id,
              deleted_at
            ),
            attachments:task_attachments (
              id,
              task_id,
              storage_path,
              original_name,
              mime_type,
              file_size,
              uploaded_by,
              created_at,
              updated_at,
              deleted_at
            )
          `
          )
          .eq('project_id', projectId)

        if (error) {
          console.error('Failed to refresh project tasks', { projectId, error })
          return
        }

        const rows = (data ?? []) as RawTaskWithRelations[]
        const normalizedTasks = rows.map(normalizeRawTask)
        const nextActive = normalizedTasks.filter(task => !task.deleted_at)
        const nextArchived = normalizedTasks.filter(task =>
          Boolean(task.deleted_at)
        )

        startTransition(() => {
          setTasksByProject(prev => {
            const next = new Map(prev)
            next.set(projectId, nextActive)
            return next
          })
          setArchivedTasksByProject(prev => {
            const next = new Map(prev)
            next.set(projectId, nextArchived)
            return next
          })
        })
      } finally {
        refreshInFlightRef.current.delete(projectId)
      }
    },
    [
      setArchivedTasksByProject,
      setTasksByProject,
      startTransition,
      supabase,
      trackedProjectIdsSet,
    ]
  )

  const flushQueuedRefreshes = useCallback(() => {
    if (!refreshQueueRef.current.size) {
      return
    }

    const pending = Array.from(refreshQueueRef.current)
    refreshQueueRef.current.clear()
    refreshTimerRef.current = null

    pending.forEach(projectId => {
      void refreshProjectTasks(projectId)
    })
  }, [refreshProjectTasks])

  const scheduleRefresh = useCallback(
    (projectId: string) => {
      if (!trackedProjectIdsSet.has(projectId)) {
        return
      }

      refreshQueueRef.current.add(projectId)

      if (refreshTimerRef.current !== null) {
        return
      }

      refreshTimerRef.current = window.setTimeout(() => {
        flushQueuedRefreshes()
      }, 75)
    },
    [flushQueuedRefreshes, trackedProjectIdsSet]
  )

  useEffect(() => {
    const queue = refreshQueueRef.current

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      queue.clear()
    }
  }, [])

  useEffect(() => {
    if (!trackedProjectIds.length) {
      return
    }

    const filterValues = trackedProjectIds.map(id => '"' + id + '"').join(',')

    const channel = supabase
      .channel(`projects-board-tasks:${trackedProjectIds.join(',')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=in.(${filterValues})`,
        },
        payload => {
          const projectId =
            (payload.new as { project_id?: string } | null)?.project_id ??
            (payload.old as { project_id?: string } | null)?.project_id ??
            null

          if (!projectId) {
            return
          }

          scheduleRefresh(projectId)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [scheduleRefresh, supabase, trackedProjectIds])

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

  const { handleDragStart, handleDragEnd, draggingTask } = useBoardDnDState({
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
    activeProject,
    activeProjectTasks,
    activeProjectArchivedTasks,
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
  }
}
