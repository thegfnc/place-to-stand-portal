'use client'

import { useCallback, useMemo } from 'react'
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

import { useToast } from '@/components/ui/use-toast'
import { useProjectsBoardState } from '@/lib/projects/board/use-projects-board-state'
import { useBoardAssignedFilter } from '@/lib/projects/board/state/use-board-assigned-filter'
import { useBoardScrollPersistence } from '@/lib/projects/board/state/use-board-scroll-persistence'
import { useBoardTimeLogDialogs } from '@/lib/projects/board/state/use-board-time-log-dialogs'
import { useProjectsBoardDerivedState } from '@/lib/projects/board/state/use-projects-board-derived-state'
import { useProjectCalendarSync } from '@/lib/projects/calendar/use-project-calendar-sync'
import { createRenderAssignees } from '@/lib/projects/board/board-selectors'
import { useProjectsBoardReviewActions } from '../_hooks/use-projects-board-review-actions'

import type { ProjectsBoardTabsSectionProps } from '../_components/projects-board/projects-board-tabs-section'
import type { ProjectsBoardDialogsProps } from '../_components/projects-board-dialogs'
import { useProjectsBoardNavigation } from './use-projects-board-navigation'

const NO_PROJECTS_TITLE = 'No projects assigned yet'
const NO_PROJECTS_DESCRIPTION =
  'Once an administrator links you to a project, the workspace will unlock here.'

type UseProjectsBoardStateArgs = Parameters<typeof useProjectsBoardState>[0]

type BaseProps = Omit<UseProjectsBoardStateArgs, 'currentView'>

export type ProjectsBoardProps = BaseProps & {
  initialTab?: 'board' | 'calendar' | 'activity' | 'backlog' | 'review'
}

export type ProjectsBoardHeaderProps = {
  clientItems: Array<{ value: string; label: string; keywords: string[] }>
  projectItems: Array<{ value: string; label: string; keywords: string[] }>
  selectedClientId: string | null
  selectedProjectId: string | null
  onClientChange: (clientId: string) => void
  onProjectChange: (projectId: string | null) => void
}

export type ProjectsBoardBurndownProps = {
  visible: boolean
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  canLogTime: boolean
  addTimeLogDisabledReason: string | null
  onAddTimeLog: () => void
  onViewTimeLogs: () => void
}

export type ProjectsBoardViewModel = {
  header: ProjectsBoardHeaderProps
  tabs: ProjectsBoardTabsSectionProps
  dialogs: ProjectsBoardDialogsProps
  burndown: ProjectsBoardBurndownProps
  emptyState: { title: string; description: string }
  isEmpty: boolean
}

export function useProjectsBoardViewModel({
  initialTab = 'board',
  ...props
}: ProjectsBoardProps): ProjectsBoardViewModel {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )
  const { toast } = useToast()

  const {
    isPending,
    feedback,
    selectedClientId,
    selectedProjectId,
    clientItems,
    projectItems,
    activeProject,
    activeProjectTasks,
    activeProjectArchivedTasks,
    canManageTasks,
    memberDirectory,
    tasksByColumn,
    draggingTask,
    isSheetOpen,
    sheetTask,
    scrimLocked,
    handleClientSelect,
    handleProjectSelect,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleCalendarDragStart,
    handleCalendarDragEnd,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
    defaultTaskDueOn,
    calendarDraggingTask,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
  } = useProjectsBoardState({ ...props, currentView: initialTab })

  const canLogTime = props.currentUserRole !== 'CLIENT'
  const addTimeLogDisabledReason = canLogTime
    ? null
    : 'Clients can review logged hours but cannot add new entries.'

  const activeProjectId = activeProject?.id ?? null
  const storageNamespace = props.currentUserId
    ? `projects-board-assigned-filter:${props.currentUserId}`
    : null
  const canAcceptTasks = props.currentUserRole === 'ADMIN'

  const { onlyAssignedToMe, handleAssignedFilterChange } =
    useBoardAssignedFilter({
      activeProjectId,
      storageNamespace,
    })

  const { boardViewportRef, handleBoardScroll } = useBoardScrollPersistence({
    activeProjectId,
  })

  const {
    isTimeLogDialogOpen,
    timeLogProjectId,
    handleTimeLogDialogOpenChange,
    isViewTimeLogsOpen,
    viewTimeLogsProjectId,
    handleViewTimeLogsDialogOpenChange,
  } = useBoardTimeLogDialogs({ activeProject, canLogTime })

  const navigation = useProjectsBoardNavigation({
    activeProject,
    clients: props.clients,
  })

  const activeProjectSummary = useMemo(() => {
    if (!activeProject) {
      return null
    }

    return {
      id: activeProject.id,
      name: activeProject.name,
      client: {
        id: activeProject.client?.id ?? null,
        name: activeProject.client?.name ?? null,
      },
      burndown: {
        totalClientRemainingHours:
          activeProject.burndown.totalClientRemainingHours,
        totalProjectLoggedHours: activeProject.burndown.totalProjectLoggedHours,
      },
    }
  }, [activeProject])

  const renderAssignees = useMemo(
    () => createRenderAssignees(memberDirectory),
    [memberDirectory]
  )

  useProjectCalendarSync({
    activeProjectId,
    tasks: activeProjectTasks,
  })

  const {
    onDeckTasks,
    backlogTasks,
    tasksByColumnToRender,
    acceptedTasks,
    archivedTasks,
    doneColumnTasks,
    acceptAllDisabled,
    acceptAllDisabledReason,
  } = useProjectsBoardDerivedState({
    activeProjectTasks,
    activeProjectArchivedTasks,
    tasksByColumn,
    onlyAssignedToMe,
    currentUserId: props.currentUserId ?? null,
    canAcceptTasks,
  })

  const {
    handleAcceptAllDone,
    handleAcceptTask,
    handleUnacceptTask,
    handleRestoreTask,
    handleDestroyTask,
    isAcceptingDone,
    isReviewActionPending,
    pendingReviewAction,
  } = useProjectsBoardReviewActions({
    canAcceptTasks,
    activeProjectId,
    toast,
  })

  const activeSheetTaskId = sheetTask?.id ?? null

  const reviewActionTaskId = pendingReviewAction?.taskId ?? null
  const reviewActionType = pendingReviewAction?.type ?? null
  const reviewActionDisabledReason = canAcceptTasks
    ? null
    : 'Only administrators can manage review tasks.'

  const handleCreateTaskForDate = useCallback(
    (dueOn: string) => {
      openCreateSheet(undefined, { dueOn })
    },
    [openCreateSheet]
  )

  const tabs: ProjectsBoardTabsSectionProps = {
    initialTab,
    navigation,
    assignmentFilter: {
      onlyAssignedToMe,
      onAssignedFilterChange: handleAssignedFilterChange,
    },
    board: {
      feedback,
      activeProject: activeProjectSummary,
      canManageTasks,
      renderAssignees,
      tasksByColumn: tasksByColumnToRender,
      calendarProjectId: activeProject?.id ?? null,
      calendarAssignedUserId: props.currentUserId ?? null,
      onEditTask: handleEditTask,
      onCreateTask: openCreateSheet,
      onCreateTaskForDate: handleCreateTaskForDate,
      activeSheetTaskId,
      activityTargetClientId: activeProject?.client?.id ?? null,
    },
    drag: {
      sensors,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      draggingTask,
      scrimLocked,
      isPending,
      boardViewportRef,
      onBoardScroll: handleBoardScroll,
    },
    calendarDrag: {
      onCalendarDragStart: handleCalendarDragStart,
      onCalendarDragEnd: handleCalendarDragEnd,
      calendarDraggingTask,
    },
    backlog: {
      onDeckTasks,
      backlogTasks,
    },
    review: {
      doneTasks: doneColumnTasks,
      acceptedTasks,
      archivedTasks,
      onAcceptAllDone: handleAcceptAllDone,
      acceptAllDisabled,
      acceptAllDisabledReason,
      isAcceptingDone,
      onAcceptTask: handleAcceptTask,
      onUnacceptTask: handleUnacceptTask,
      onRestoreTask: handleRestoreTask,
      onDestroyTask: handleDestroyTask,
      reviewActionTaskId,
      reviewActionType,
      reviewActionDisabledReason,
      isReviewActionPending,
    },
    drop: {
      activeDropColumnId,
      dropPreview,
      recentlyMovedTaskId,
    },
  }

  const dialogs: ProjectsBoardDialogsProps = {
    activeProject,
    sheetState: {
      open: isSheetOpen,
      onOpenChange: handleSheetOpenChange,
      task: sheetTask,
      canManage: canManageTasks,
      admins: props.admins,
      currentUserId: props.currentUserId,
      currentUserRole: props.currentUserRole,
      defaultStatus: defaultTaskStatus,
      defaultDueOn: defaultTaskDueOn,
    },
    timeLogState: {
      isOpen: isTimeLogDialogOpen,
      onOpenChange: handleTimeLogDialogOpenChange,
      canLogTime,
      timeLogProjectId,
      tasks: activeProjectTasks,
      currentUserId: props.currentUserId,
      currentUserRole: props.currentUserRole,
      admins: props.admins,
    },
    timeLogHistoryState: {
      isOpen: isViewTimeLogsOpen,
      onOpenChange: handleViewTimeLogsDialogOpenChange,
      viewTimeLogsProjectId,
      currentUserId: props.currentUserId,
      currentUserRole: props.currentUserRole,
    },
  }

  const burndown: ProjectsBoardBurndownProps = {
    visible: Boolean(activeProject),
    totalClientRemainingHours:
      activeProject?.burndown.totalClientRemainingHours ?? 0,
    totalProjectLoggedHours:
      activeProject?.burndown.totalProjectLoggedHours ?? 0,
    canLogTime,
    addTimeLogDisabledReason,
    onAddTimeLog: () => handleTimeLogDialogOpenChange(true),
    onViewTimeLogs: () => handleViewTimeLogsDialogOpenChange(true),
  }

  const header: ProjectsBoardHeaderProps = {
    clientItems,
    projectItems,
    selectedClientId,
    selectedProjectId,
    onClientChange: handleClientSelect,
    onProjectChange: handleProjectSelect,
  }

  return {
    header,
    tabs,
    dialogs,
    burndown,
    emptyState: {
      title: NO_PROJECTS_TITLE,
      description: NO_PROJECTS_DESCRIPTION,
    },
    isEmpty: props.projects.length === 0,
  }
}
