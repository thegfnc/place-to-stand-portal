'use client'

import { useCallback, useMemo } from 'react'

import type { ProjectsBoardTabsSectionProps } from '../_components/projects-board/projects-board-tabs-section'
import type { ProjectsBoardDialogsProps } from '../_components/projects-board-dialogs'
import { buildProjectsBoardBurndown } from './builders/build-projects-board-burndown'
import { buildProjectsBoardDialogs } from './builders/build-projects-board-dialogs'
import { buildProjectsBoardHeader } from './builders/build-projects-board-header'
import { buildProjectsBoardTabs } from './builders/build-projects-board-tabs'
import {
  useProjectsBoardCoreState,
  type UseProjectsBoardCoreStateArgs,
} from './use-projects-board-core-state'
import { useProjectsBoardNavigation } from './use-projects-board-navigation'
import { useProjectsBoardSensors } from './use-projects-board-sensors'

const NO_PROJECTS_TITLE = 'No projects assigned yet'
const NO_PROJECTS_DESCRIPTION =
  'Once an administrator links you to a project, the workspace will unlock here.'

type BaseProps = Omit<UseProjectsBoardCoreStateArgs, 'currentView'>

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
  onSelectNextProject: () => void
  onSelectPreviousProject: () => void
  canSelectNext: boolean
  canSelectPrevious: boolean
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
  const { sensors } = useProjectsBoardSensors()
  const {
    boardState,
    derivedState,
    reviewActions,
    renderAssignees,
    handleAssignedFilterChange,
    onlyAssignedToMe,
    boardViewportRef,
    handleBoardScroll,
    timeLogDialogs,
    canLogTime,
    canAcceptTasks,
  } = useProjectsBoardCoreState({ ...props, currentView: initialTab })

  const addTimeLogDisabledReason = canLogTime
    ? null
    : 'Clients can review logged hours but cannot add new entries.'

  const navigation = useProjectsBoardNavigation({
    activeProject: boardState.activeProject,
    clients: props.clients,
  })

  const activeProjectSummary = useMemo(() => {
    if (!boardState.activeProject) {
      return null
    }

    return {
      id: boardState.activeProject.id,
      name: boardState.activeProject.name,
      client: {
        id: boardState.activeProject.client?.id ?? null,
        name: boardState.activeProject.client?.name ?? null,
      },
      burndown: {
        totalClientRemainingHours:
          boardState.activeProject.burndown.totalClientRemainingHours,
        totalProjectLoggedHours:
          boardState.activeProject.burndown.totalProjectLoggedHours,
      },
    }
  }, [boardState.activeProject])

  const reviewActionTaskId = reviewActions.pendingReviewAction?.taskId ?? null
  const reviewActionType = reviewActions.pendingReviewAction?.type ?? null
  const reviewActionDisabledReason = canAcceptTasks
    ? null
    : 'Only administrators can manage review tasks.'

  const handleCreateTaskForDate = useCallback(
    (dueOn: string) => {
      boardState.openCreateSheet(undefined, { dueOn })
    },
    [boardState]
  )

  const header = buildProjectsBoardHeader({
    clientItems: boardState.clientItems,
    projectItems: boardState.projectItems,
    selectedClientId: boardState.selectedClientId,
    selectedProjectId: boardState.selectedProjectId,
    onClientChange: boardState.handleClientSelect,
    onProjectChange: boardState.handleProjectSelect,
    onSelectNextProject: boardState.handleSelectNextProject,
    onSelectPreviousProject: boardState.handleSelectPreviousProject,
    canSelectNextProject: boardState.canSelectNextProject,
    canSelectPreviousProject: boardState.canSelectPreviousProject,
  })

  const tabs = buildProjectsBoardTabs({
    initialTab,
    navigation,
    assignmentFilter: {
      onlyAssignedToMe,
      onAssignedFilterChange: handleAssignedFilterChange,
    },
    board: {
      feedback: boardState.feedback,
      activeProject: activeProjectSummary,
      canManageTasks: boardState.canManageTasks,
      renderAssignees,
      tasksByColumn: derivedState.tasksByColumnToRender,
      calendarProjectId: boardState.activeProject?.id ?? null,
      calendarAssignedUserId: props.currentUserId ?? null,
      onEditTask: boardState.handleEditTask,
      onCreateTask: boardState.openCreateSheet,
      onCreateTaskForDate: handleCreateTaskForDate,
      activeSheetTaskId: boardState.sheetTask?.id ?? null,
      activityTargetClientId: boardState.activeProject?.client?.id ?? null,
    },
    drag: {
      sensors,
      onDragStart: boardState.handleDragStart,
      onDragOver: boardState.handleDragOver,
      onDragEnd: boardState.handleDragEnd,
      draggingTask: boardState.draggingTask,
      scrimLocked: boardState.scrimLocked,
      isPending: boardState.isPending,
      boardViewportRef,
      onBoardScroll: handleBoardScroll,
    },
    calendarDrag: {
      onCalendarDragStart: boardState.handleCalendarDragStart,
      onCalendarDragEnd: boardState.handleCalendarDragEnd,
      calendarDraggingTask: boardState.calendarDraggingTask,
    },
    backlog: {
      onDeckTasks: derivedState.onDeckTasks,
      backlogTasks: derivedState.backlogTasks,
    },
    review: {
      doneTasks: derivedState.doneColumnTasks,
      acceptedTasks: derivedState.acceptedTasks,
      archivedTasks: derivedState.archivedTasks,
      onAcceptAllDone: reviewActions.handleAcceptAllDone,
      acceptAllDisabled: derivedState.acceptAllDisabled,
      acceptAllDisabledReason: derivedState.acceptAllDisabledReason,
      isAcceptingDone: reviewActions.isAcceptingDone,
      onAcceptTask: reviewActions.handleAcceptTask,
      onUnacceptTask: reviewActions.handleUnacceptTask,
      onRestoreTask: reviewActions.handleRestoreTask,
      onDestroyTask: reviewActions.handleDestroyTask,
      reviewActionTaskId,
      reviewActionType,
      reviewActionDisabledReason,
      isReviewActionPending: reviewActions.isReviewActionPending,
    },
    drop: {
      activeDropColumnId: boardState.activeDropColumnId,
      dropPreview: boardState.dropPreview,
      recentlyMovedTaskId: boardState.recentlyMovedTaskId,
    },
  })

  const dialogs = buildProjectsBoardDialogs({
    activeProject: boardState.activeProject,
    sheetState: {
      open: boardState.isSheetOpen,
      onOpenChange: boardState.handleSheetOpenChange,
      task: boardState.sheetTask,
      canManage: boardState.canManageTasks,
      admins: props.admins,
      currentUserId: props.currentUserId,
      currentUserRole: props.currentUserRole,
      defaultStatus: boardState.defaultTaskStatus,
      defaultDueOn: boardState.defaultTaskDueOn,
    },
    timeLogState: {
      isOpen: timeLogDialogs.isTimeLogDialogOpen,
      onOpenChange: timeLogDialogs.handleTimeLogDialogOpenChange,
      canLogTime,
      timeLogProjectId: timeLogDialogs.timeLogProjectId,
      tasks: boardState.activeProjectTasks,
      currentUserId: props.currentUserId,
      currentUserRole: props.currentUserRole,
      admins: props.admins,
    },
    timeLogHistoryState: {
      isOpen: timeLogDialogs.isViewTimeLogsOpen,
      onOpenChange: timeLogDialogs.handleViewTimeLogsDialogOpenChange,
      viewTimeLogsProjectId: timeLogDialogs.viewTimeLogsProjectId,
      currentUserId: props.currentUserId,
      currentUserRole: props.currentUserRole,
    },
  })

  const burndown = buildProjectsBoardBurndown({
    activeProject: boardState.activeProject,
    canLogTime,
    addTimeLogDisabledReason,
    onAddTimeLog: () => timeLogDialogs.handleTimeLogDialogOpenChange(true),
    onViewTimeLogs: () => timeLogDialogs.handleViewTimeLogsDialogOpenChange(true),
  })

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
