import type { RefObject, UIEventHandler } from 'react'
import { Tabs } from '@/components/ui/tabs'
import type { TaskWithRelations } from '@/lib/types'
import type { DndContextProps } from '@dnd-kit/core'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'

import { BoardTabContent } from './board-tab-content'
import { BacklogTabContent } from './backlog-tab-content'
import { ActivityTabContent } from './activity-tab-content'
import { ProjectsBoardTabsHeader } from './projects-board-tabs-header'
import type { ProjectsBoardActiveProject } from './board-tab-content'

export type ProjectsBoardTabsProps = {
  initialTab: 'board' | 'backlog' | 'activity'
  boardHref: string
  backlogHref: string
  activityHref: string
  backlogDisabled: boolean
  activityDisabled: boolean
  onlyAssignedToMe: boolean
  onAssignedFilterChange: (checked: boolean) => void
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  canManageTasks: boolean
  renderAssignees: RenderAssigneeFn
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  sensors: DndContextProps['sensors']
  onDragStart: DndContextProps['onDragStart']
  onDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  scrimLocked: boolean
  isPending: boolean
  boardViewportRef: RefObject<HTMLDivElement | null>
  onBoardScroll: UIEventHandler<HTMLDivElement>
  onDeckTasks: TaskWithRelations[]
  backlogTasks: TaskWithRelations[]
  activeSheetTaskId: string | null
  activityTargetClientId: string | null
}

export function ProjectsBoardTabs(props: ProjectsBoardTabsProps) {
  const {
    initialTab,
    boardHref,
    backlogHref,
    activityHref,
    backlogDisabled,
    activityDisabled,
    onlyAssignedToMe,
    onAssignedFilterChange,
    feedback,
    activeProject,
    canManageTasks,
    renderAssignees,
    tasksByColumn,
    onEditTask,
    onCreateTask,
    sensors,
    onDragStart,
    onDragEnd,
    draggingTask,
    scrimLocked,
    isPending,
    boardViewportRef,
    onBoardScroll,
    onDeckTasks,
    backlogTasks,
    activeSheetTaskId,
    activityTargetClientId,
  } = props

  return (
    <Tabs value={initialTab} className='flex min-h-0 flex-1 flex-col gap-2'>
      <ProjectsBoardTabsHeader
        initialTab={initialTab}
        boardHref={boardHref}
        backlogHref={backlogHref}
        activityHref={activityHref}
        backlogDisabled={backlogDisabled}
        activityDisabled={activityDisabled}
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
    </Tabs>
  )
}
