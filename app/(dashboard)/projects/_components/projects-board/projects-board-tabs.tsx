import type { RefObject, UIEventHandler } from 'react'
import { Tabs } from '@/components/ui/tabs'
import type { TaskWithRelations } from '@/lib/types'
import type { DndContextProps } from '@dnd-kit/core'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'

import { BoardTabContent } from './board-tab-content'
import { CalendarTabContent } from './calendar-tab-content'
import { RefineTabContent } from './refine-tab-content'
import { ActivityTabContent } from './activity-tab-content'
import { ReviewTabContent } from './review-tab-content'
import type { ReviewActionKind } from './review-tab-content'
import { ProjectsBoardTabsHeader } from './projects-board-tabs-header'
import type { ProjectsBoardActiveProject } from './board-tab-content'

export type ProjectsBoardTabsProps = {
  initialTab: 'board' | 'calendar' | 'refine' | 'activity' | 'review'
  boardHref: string
  calendarHref: string
  refineHref: string
  activityHref: string
  reviewHref: string
  calendarDisabled: boolean
  refineDisabled: boolean
  activityDisabled: boolean
  reviewDisabled: boolean
  onlyAssignedToMe: boolean
  onAssignedFilterChange: (checked: boolean) => void
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  canManageTasks: boolean
  renderAssignees: RenderAssigneeFn
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  calendarTasks: TaskWithRelations[]
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  onCreateTaskForDate: (dueOn: string) => void
  sensors: DndContextProps['sensors']
  onDragStart: DndContextProps['onDragStart']
  onDragEnd: DndContextProps['onDragEnd']
  onCalendarDragStart: DndContextProps['onDragStart']
  onCalendarDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  calendarDraggingTask: TaskWithRelations | null
  scrimLocked: boolean
  isPending: boolean
  boardViewportRef: RefObject<HTMLDivElement | null>
  onBoardScroll: UIEventHandler<HTMLDivElement>
  onDeckTasks: TaskWithRelations[]
  backlogTasks: TaskWithRelations[]
  activeSheetTaskId: string | null
  activityTargetClientId: string | null
  doneTasks: TaskWithRelations[]
  acceptedTasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  onAcceptAllDone: () => void
  acceptAllDisabled: boolean
  acceptAllDisabledReason: string | null
  isAcceptingDone: boolean
  onAcceptTask: (taskId: string) => void
  onUnacceptTask: (taskId: string) => void
  onRestoreTask: (taskId: string) => void
  onDestroyTask: (taskId: string) => void
  reviewActionTaskId: string | null
  reviewActionType: ReviewActionKind | null
  reviewActionDisabledReason: string | null
  isReviewActionPending: boolean
}

export function ProjectsBoardTabs(props: ProjectsBoardTabsProps) {
  const {
    initialTab,
    boardHref,
    calendarHref,
    refineHref,
    activityHref,
    reviewHref,
    calendarDisabled,
    refineDisabled,
    activityDisabled,
    reviewDisabled,
    onlyAssignedToMe,
    onAssignedFilterChange,
    feedback,
    activeProject,
    canManageTasks,
    renderAssignees,
    tasksByColumn,
    calendarTasks,
    onEditTask,
    onCreateTask,
    onCreateTaskForDate,
    sensors,
    onDragStart,
    onDragEnd,
    onCalendarDragStart,
    onCalendarDragEnd,
    draggingTask,
    calendarDraggingTask,
    scrimLocked,
    isPending,
    boardViewportRef,
    onBoardScroll,
    onDeckTasks,
    backlogTasks,
    activeSheetTaskId,
    activityTargetClientId,
    doneTasks,
    acceptedTasks,
    archivedTasks,
    onAcceptAllDone,
    acceptAllDisabled,
    acceptAllDisabledReason,
    isAcceptingDone,
    onAcceptTask,
    onUnacceptTask,
    onRestoreTask,
    onDestroyTask,
    reviewActionTaskId,
    reviewActionType,
    reviewActionDisabledReason,
    isReviewActionPending,
  } = props

  return (
    <Tabs value={initialTab} className='flex min-h-0 flex-1 flex-col gap-2'>
      <ProjectsBoardTabsHeader
        initialTab={initialTab}
        boardHref={boardHref}
        calendarHref={calendarHref}
        refineHref={refineHref}
        activityHref={activityHref}
        reviewHref={reviewHref}
        calendarDisabled={calendarDisabled}
        refineDisabled={refineDisabled}
        activityDisabled={activityDisabled}
        reviewDisabled={reviewDisabled}
        onlyAssignedToMe={onlyAssignedToMe}
        onAssignedFilterChange={onAssignedFilterChange}
      />
      <BoardTabContent
        isActive={initialTab === 'board'}
        feedback={feedback}
        activeProject={activeProject}
        tasksByColumn={tasksByColumn}
        renderAssignees={renderAssignees}
        canManageTasks={canManageTasks}
        onEditTask={onEditTask}
        onCreateTask={onCreateTask}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        draggingTask={draggingTask}
        scrimLocked={scrimLocked}
        isPending={isPending}
        boardViewportRef={boardViewportRef}
        onBoardScroll={onBoardScroll}
        activeSheetTaskId={activeSheetTaskId}
      />
      <CalendarTabContent
        isActive={initialTab === 'calendar'}
        feedback={feedback}
        activeProject={activeProject}
        tasks={calendarTasks}
        renderAssignees={renderAssignees}
        canManageTasks={canManageTasks}
        onEditTask={onEditTask}
        onCreateTask={onCreateTaskForDate}
        sensors={sensors}
        onDragStart={onCalendarDragStart}
        onDragEnd={onCalendarDragEnd}
        draggingTask={calendarDraggingTask}
        scrimLocked={scrimLocked}
        isPending={isPending}
      />
      <RefineTabContent
        isActive={initialTab === 'refine'}
        feedback={feedback}
        activeProject={activeProject}
        onDeckTasks={onDeckTasks}
        backlogTasks={backlogTasks}
        canManageTasks={canManageTasks}
        renderAssignees={renderAssignees}
        onEditTask={onEditTask}
        onCreateTask={onCreateTask}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        draggingTask={draggingTask}
        scrimLocked={scrimLocked}
        isPending={isPending}
        activeSheetTaskId={activeSheetTaskId}
      />
      <ActivityTabContent
        isActive={initialTab === 'activity'}
        activeProject={activeProject}
        activityTargetClientId={activityTargetClientId}
      />
      <ReviewTabContent
        isActive={initialTab === 'review'}
        activeProject={activeProject}
        feedback={feedback}
        doneTasks={doneTasks}
        acceptedTasks={acceptedTasks}
        archivedTasks={archivedTasks}
        renderAssignees={renderAssignees}
        onEditTask={onEditTask}
        onAcceptTask={onAcceptTask}
        onAcceptAllDone={onAcceptAllDone}
        acceptAllDisabled={acceptAllDisabled}
        acceptAllDisabledReason={acceptAllDisabledReason}
        isAcceptingDone={isAcceptingDone}
        activeSheetTaskId={activeSheetTaskId}
        onUnacceptTask={onUnacceptTask}
        onRestoreTask={onRestoreTask}
        onDestroyTask={onDestroyTask}
        reviewActionTaskId={reviewActionTaskId}
        reviewActionType={reviewActionType}
        reviewActionDisabledReason={reviewActionDisabledReason}
        isReviewActionPending={isReviewActionPending}
      />
    </Tabs>
  )
}
