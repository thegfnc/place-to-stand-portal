'use client'

import { useMemo } from 'react'

import type { ProjectsBoardTabsSectionProps } from '../_components/projects-board/projects-board-tabs-section'
import type { ProjectsBoardDialogsProps } from '../_components/projects-board-dialogs'
import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
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
  initialTab?: 'overview' | 'board' | 'activity' | 'review' | 'timeLogs'
}

export type ProjectsBoardHeaderProps = {
  projectItems: SearchableComboboxItem[]
  projectGroups?: SearchableComboboxGroup[]
  selectedProjectId: string | null
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
  projectMonthToDateLoggedHours: number
  onAddTimeLog: () => void
  viewTimeLogsHref: string | null
  showProjectMonthToDate: boolean
  showClientRemainingCard: boolean
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
  const currentBoardView = initialTab === 'timeLogs' || initialTab === 'overview' ? 'board' : initialTab
  const { sensors } = useProjectsBoardSensors()
  const {
    boardState,
    derivedState,
    reviewActions,
    renderAssignees,
    boardViewportRef,
    handleBoardScroll,
    timeLogDialogs,
  } = useProjectsBoardCoreState({ ...props, currentView: currentBoardView })

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
      slug: boardState.activeProject.slug,
      status: boardState.activeProject.status,
      client: {
        id: boardState.activeProject.client?.id ?? null,
        name: boardState.activeProject.client?.name ?? null,
        slug: boardState.activeProject.client?.slug ?? null,
        billing_type: boardState.activeProject.client?.billing_type ?? null,
      },
      owner: boardState.activeProject.owner,
      starts_on: boardState.activeProject.starts_on,
      ends_on: boardState.activeProject.ends_on,
      githubRepos: boardState.activeProject.githubRepos,
      integrationLinks: boardState.activeProject.integrationLinks,
      burndown: {
        totalClientRemainingHours:
          boardState.activeProject.burndown.totalClientRemainingHours,
        totalProjectLoggedHours:
          boardState.activeProject.burndown.totalProjectLoggedHours,
        projectMonthToDateLoggedHours:
          boardState.activeProject.burndown.projectMonthToDateLoggedHours,
      },
    }
  }, [boardState.activeProject])

  const reviewActionTaskId = reviewActions.pendingReviewAction?.taskId ?? null
  const reviewActionType = reviewActions.pendingReviewAction?.type ?? null

  const header = buildProjectsBoardHeader({
    projectItems: boardState.projectItems,
    projectGroups: boardState.projectGroups,
    selectedProjectId: boardState.selectedProjectId,
    onProjectChange: boardState.handleProjectSelect,
    onSelectNextProject: boardState.handleSelectNextProject,
    onSelectPreviousProject: boardState.handleSelectPreviousProject,
    canSelectNextProject: boardState.canSelectNextProject,
    canSelectPreviousProject: boardState.canSelectPreviousProject,
  })

  const tabs = buildProjectsBoardTabs({
    initialTab,
    navigation,
    board: {
      feedback: boardState.feedback,
      activeProject: activeProjectSummary,
      canManageTasks: boardState.canManageTasks,
      renderAssignees,
      tasksByColumn: derivedState.tasksByColumnToRender,
      onEditTask: boardState.handleEditTask,
      onCreateTask: boardState.openCreateSheet,
      activeSheetTaskId: boardState.sheetTask?.id ?? null,
      activityTargetClientId: boardState.activeProject?.client?.id ?? null,
      doneWeeks: boardState.doneWeeks,
      hiddenDoneCount: boardState.hiddenDoneCount,
      onWidenDoneWindow: boardState.widenDoneWindow,
    },
    drag: {
      sensors,
      onDragStart: boardState.handleDragStart,
      onDragOver: boardState.handleDragOver,
      onDragEnd: boardState.handleDragEnd,
      draggingTask: boardState.draggingTask,
      isPending: boardState.isPending,
      boardViewportRef,
      onBoardScroll: handleBoardScroll,
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
      isReviewActionPending: reviewActions.isReviewActionPending,
    },
    drop: {
      activeDropColumnId: boardState.activeDropColumnId,
      dropPreview: boardState.dropPreview,
      recentlyMovedTaskId: boardState.recentlyMovedTaskId,
    },
    timeLogs: {
      currentUserId: props.currentUserId,
      onEditTimeLogEntry: timeLogDialogs.openEditTimeLogDialog,
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
      defaultStatus: boardState.defaultTaskStatus,
      defaultDueOn: boardState.defaultTaskDueOn,
    },
    timeLogState: {
      isOpen: timeLogDialogs.isTimeLogDialogOpen,
      onOpenChange: timeLogDialogs.handleTimeLogDialogOpenChange,
      timeLogProjectId: timeLogDialogs.timeLogProjectId,
      tasks: boardState.activeProjectTasks,
      currentUserId: props.currentUserId,
      admins: props.admins,
      mode: timeLogDialogs.mode,
      editingEntry: timeLogDialogs.editingEntry,
    },
    projects: props.projects,
  })

  const burndown = buildProjectsBoardBurndown({
    activeProject: boardState.activeProject,
    onAddTimeLog: () => timeLogDialogs.openCreateTimeLogDialog(),
    viewTimeLogsHref: navigation.timeLogsDisabled
      ? null
      : navigation.timeLogsHref,
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
