import { useEffect } from 'react'
import type { RefObject, UIEventHandler } from 'react'
import { Tabs } from '@/components/ui/tabs'
import type { TaskWithRelations } from '@/lib/types'
import type { DndContextProps } from '@dnd-kit/core'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { completeBoardTabInteraction } from '@/lib/projects/board/board-tab-interaction'
import type { UserRole } from '@/lib/auth/session'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

import { BoardTabContent } from './board-tab-content'
import { CalendarTabContent } from './calendar-tab-content'
import { BacklogTabContent } from './backlog-tab-content'
import { ActivityTabContent } from './activity-tab-content'
import { ReviewTabContent } from './review-tab-content'
import type { ReviewActionKind } from './review-tab/review-tab.types'
import { ProjectsBoardTabsHeader } from './projects-board-tabs-header'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import { TimeLogsTabContent } from './time-logs-tab-content'

export type ProjectsBoardTabsProps = {
  initialTab:
    | 'board'
    | 'calendar'
    | 'backlog'
    | 'activity'
    | 'review'
    | 'timeLogs'
  boardHref: string
  calendarHref: string
  backlogHref: string
  activityHref: string
  reviewHref: string
  timeLogsHref: string
  calendarDisabled: boolean
  backlogDisabled: boolean
  activityDisabled: boolean
  reviewDisabled: boolean
  timeLogsDisabled: boolean
  onlyAssignedToMe: boolean
  onAssignedFilterChange: (checked: boolean) => void
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  canManageTasks: boolean
  renderAssignees: RenderAssigneeFn
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  calendarProjectId: string | null
  calendarAssignedUserId: string | null
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  onCreateTaskForDate: (dueOn: string) => void
  sensors: DndContextProps['sensors']
  onDragStart: DndContextProps['onDragStart']
  onDragOver: DndContextProps['onDragOver']
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
  activeDropColumnId: BoardColumnId | null
  dropPreview: { columnId: BoardColumnId; index: number } | null
  recentlyMovedTaskId: string | null
  currentUserId: string
  currentUserRole: UserRole
  canLogTime: boolean
  onEditTimeLogEntry: (entry: TimeLogEntry) => void
}

export function ProjectsBoardTabs(props: ProjectsBoardTabsProps) {
  const {
    initialTab,
    boardHref,
    calendarHref,
    backlogHref,
    activityHref,
    reviewHref,
    timeLogsHref,
    calendarDisabled,
    backlogDisabled,
    activityDisabled,
    reviewDisabled,
    timeLogsDisabled,
    onlyAssignedToMe,
    onAssignedFilterChange,
    feedback,
    activeProject,
    canManageTasks,
    renderAssignees,
    tasksByColumn,
    calendarProjectId,
    calendarAssignedUserId,
    onEditTask,
    onCreateTask,
    onCreateTaskForDate,
    sensors,
    onDragStart,
    onDragOver,
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
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
    currentUserId,
    currentUserRole,
    canLogTime,
    onEditTimeLogEntry,
  } = props

  useEffect(() => {
    completeBoardTabInteraction(initialTab)
  }, [initialTab])

  return (
    <Tabs value={initialTab} className='flex min-h-0 flex-1 flex-col gap-2'>
      <ProjectsBoardTabsHeader
        initialTab={initialTab}
        boardHref={boardHref}
        calendarHref={calendarHref}
        backlogHref={backlogHref}
        activityHref={activityHref}
        reviewHref={reviewHref}
        timeLogsHref={timeLogsHref}
        calendarDisabled={calendarDisabled}
        backlogDisabled={backlogDisabled}
        activityDisabled={activityDisabled}
        reviewDisabled={reviewDisabled}
        timeLogsDisabled={timeLogsDisabled}
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
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        draggingTask={draggingTask}
        scrimLocked={scrimLocked}
        isPending={isPending}
        boardViewportRef={boardViewportRef}
        onBoardScroll={onBoardScroll}
        activeSheetTaskId={activeSheetTaskId}
        activeDropColumnId={activeDropColumnId}
        dropPreview={dropPreview}
        recentlyMovedTaskId={recentlyMovedTaskId}
      />
      <CalendarTabContent
        isActive={initialTab === 'calendar'}
        feedback={feedback}
        activeProject={activeProject}
        projectId={calendarProjectId}
        assignedUserId={calendarAssignedUserId}
        onlyAssignedToMe={onlyAssignedToMe}
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
        activeSheetTaskId={activeSheetTaskId}
      />
      <BacklogTabContent
        isActive={initialTab === 'backlog'}
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
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        draggingTask={draggingTask}
        scrimLocked={scrimLocked}
        isPending={isPending}
        activeSheetTaskId={activeSheetTaskId}
        activeDropColumnId={activeDropColumnId}
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
      <TimeLogsTabContent
        key={activeProject?.id ?? 'no-project'}
        isActive={initialTab === 'timeLogs'}
        activeProject={activeProject}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        canLogTime={canLogTime}
        onEditEntry={onEditTimeLogEntry}
      />
      <ActivityTabContent
        isActive={initialTab === 'activity'}
        activeProject={activeProject}
        activityTargetClientId={activityTargetClientId}
      />
    </Tabs>
  )
}
