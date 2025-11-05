'use client'

import { ProjectsBoardTabs } from './projects-board-tabs'
import type { ProjectsBoardTabsProps } from './projects-board-tabs'

type NavigationProps = Pick<
  ProjectsBoardTabsProps,
  | 'boardHref'
  | 'calendarHref'
  | 'backlogHref'
  | 'activityHref'
  | 'reviewHref'
  | 'calendarDisabled'
  | 'backlogDisabled'
  | 'activityDisabled'
  | 'reviewDisabled'
>

type AssignmentFilterProps = Pick<
  ProjectsBoardTabsProps,
  'onlyAssignedToMe' | 'onAssignedFilterChange'
>

type BoardProps = Pick<
  ProjectsBoardTabsProps,
  | 'feedback'
  | 'activeProject'
  | 'canManageTasks'
  | 'renderAssignees'
  | 'tasksByColumn'
  | 'calendarProjectId'
  | 'calendarAssignedUserId'
  | 'onEditTask'
  | 'onCreateTask'
  | 'onCreateTaskForDate'
  | 'activeSheetTaskId'
  | 'activityTargetClientId'
>

type DragProps = Pick<
  ProjectsBoardTabsProps,
  | 'sensors'
  | 'onDragStart'
  | 'onDragOver'
  | 'onDragEnd'
  | 'draggingTask'
  | 'scrimLocked'
  | 'isPending'
  | 'boardViewportRef'
  | 'onBoardScroll'
>

type CalendarDragProps = Pick<
  ProjectsBoardTabsProps,
  'onCalendarDragStart' | 'onCalendarDragEnd' | 'calendarDraggingTask'
>

type BacklogProps = Pick<ProjectsBoardTabsProps, 'onDeckTasks' | 'backlogTasks'>

type ReviewProps = Pick<
  ProjectsBoardTabsProps,
  | 'doneTasks'
  | 'acceptedTasks'
  | 'archivedTasks'
  | 'onAcceptAllDone'
  | 'acceptAllDisabled'
  | 'acceptAllDisabledReason'
  | 'isAcceptingDone'
  | 'onAcceptTask'
  | 'onUnacceptTask'
  | 'onRestoreTask'
  | 'onDestroyTask'
  | 'reviewActionTaskId'
  | 'reviewActionType'
  | 'reviewActionDisabledReason'
  | 'isReviewActionPending'
>

type DropProps = Pick<
  ProjectsBoardTabsProps,
  'activeDropColumnId' | 'dropPreview' | 'recentlyMovedTaskId'
>

export type ProjectsBoardTabsSectionProps = {
  initialTab: ProjectsBoardTabsProps['initialTab']
  navigation: NavigationProps
  assignmentFilter: AssignmentFilterProps
  board: BoardProps
  drag: DragProps
  calendarDrag: CalendarDragProps
  backlog: BacklogProps
  review: ReviewProps
  drop: DropProps
}

export function ProjectsBoardTabsSection({
  initialTab,
  navigation,
  assignmentFilter,
  board,
  drag,
  calendarDrag,
  backlog,
  review,
  drop,
}: ProjectsBoardTabsSectionProps) {
  return (
    <ProjectsBoardTabs
      initialTab={initialTab}
      {...navigation}
      {...assignmentFilter}
      {...board}
      {...drag}
      {...calendarDrag}
      {...backlog}
      {...review}
      {...drop}
    />
  )
}
