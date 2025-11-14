"use client"

import { useMemo } from "react"

import { useProjectsBoardState } from "@/lib/projects/board/use-projects-board-state"
import { useBoardAssignedFilter } from "@/lib/projects/board/state/use-board-assigned-filter"
import { useBoardScrollPersistence } from "@/lib/projects/board/state/use-board-scroll-persistence"
import { useBoardTimeLogDialogs } from "@/lib/projects/board/state/use-board-time-log-dialogs"
import { useProjectsBoardDerivedState } from "@/lib/projects/board/state/use-projects-board-derived-state"
import { useProjectCalendarSync } from "@/lib/projects/calendar/use-project-calendar-sync"
import { createRenderAssignees } from "@/lib/projects/board/board-selectors"
import { useToast } from "@/components/ui/use-toast"

import { useProjectsBoardReviewActions } from "../_hooks/use-projects-board-review-actions"

export type UseProjectsBoardCoreStateArgs = Parameters<typeof useProjectsBoardState>[0]

export function useProjectsBoardCoreState({
  currentView,
  ...props
}: UseProjectsBoardCoreStateArgs) {
  const { toast } = useToast()

  const boardState = useProjectsBoardState({ ...props, currentView })

  const activeProjectId = boardState.activeProject?.id ?? null
  const storageNamespace = props.currentUserId
    ? `projects-board-assigned-filter:${props.currentUserId}`
    : null
  const canAcceptTasks = props.currentUserRole === "ADMIN"
  const canLogTime = props.currentUserRole !== "CLIENT"

  const { onlyAssignedToMe, handleAssignedFilterChange } = useBoardAssignedFilter({
    activeProjectId,
    storageNamespace,
  })

  const { boardViewportRef, handleBoardScroll } = useBoardScrollPersistence({
    activeProjectId,
  })

  const timeLogDialogs = useBoardTimeLogDialogs({
    activeProject: boardState.activeProject,
    canLogTime,
  })

  const derivedState = useProjectsBoardDerivedState({
    activeProjectTasks: boardState.activeProjectTasks,
    activeProjectArchivedTasks: boardState.activeProjectArchivedTasks,
    activeProjectAcceptedTasks: boardState.activeProjectAcceptedTasks,
    tasksByColumn: boardState.tasksByColumn,
    onlyAssignedToMe,
    currentUserId: props.currentUserId ?? null,
    canAcceptTasks,
  })

  const reviewActions = useProjectsBoardReviewActions({
    canAcceptTasks,
    activeProjectId,
    toast,
  })

  const renderAssignees = useMemo(
    () => createRenderAssignees(boardState.memberDirectory),
    [boardState.memberDirectory]
  )

  useProjectCalendarSync({
    activeProjectId,
    tasks: boardState.activeProjectTasks,
  })

  return {
    boardState,
    derivedState,
    reviewActions,
    renderAssignees,
    handleAssignedFilterChange,
    onlyAssignedToMe,
    boardViewportRef,
    handleBoardScroll,
    timeLogDialogs,
    canAcceptTasks,
    canLogTime,
  }
}

