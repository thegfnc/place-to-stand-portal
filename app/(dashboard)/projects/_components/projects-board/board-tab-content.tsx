import type { RefObject, UIEventHandler } from 'react'
import { DndContext, type DndContextProps } from '@dnd-kit/core'

import { TabsContent } from '@/components/ui/tabs'
import { LoadingScrim } from './loading-scrim'
import { KanbanColumn } from '../kanban-column'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { TaskDragOverlay } from '../task-drag-overlay'

import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import { BOARD_COLUMNS } from '@/lib/projects/board/board-constants'
import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'

export type ProjectsBoardActiveProject = {
  id: string
  name: string
  client: { id: string | null; name: string | null } | null
  burndown: {
    totalClientRemainingHours: number
    totalProjectLoggedHours: number
  }
} | null

export type BoardTabContentProps = {
  isActive: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  renderAssignees: RenderAssigneeFn
  canManageTasks: boolean
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
  activeSheetTaskId: string | null
}

export function BoardTabContent(props: BoardTabContentProps) {
  const {
    isActive,
    feedback,
    activeProject,
    tasksByColumn,
    renderAssignees,
    canManageTasks,
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
    activeSheetTaskId,
  } = props

  if (!isActive) {
    return null
  }

  const loadingVisible = isPending && !scrimLocked

  return (
    <TabsContent
      value='board'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <div className='relative min-h-0 flex-1'>
          <div className='absolute inset-0 overflow-hidden'>
            <div
              ref={boardViewportRef}
              className='h-full min-h-0 overflow-x-auto'
              onScroll={onBoardScroll}
            >
              <DndContext
                sensors={sensors}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              >
                <div className='flex h-full w-max gap-4 p-1'>
                  {BOARD_COLUMNS.map(column => (
                    <KanbanColumn
                      key={column.id}
                      columnId={column.id}
                      label={column.label}
                      tasks={tasksByColumn.get(column.id) ?? []}
                      renderAssignees={renderAssignees}
                      onEditTask={onEditTask}
                      canManage={canManageTasks}
                      activeTaskId={activeSheetTaskId}
                      onCreateTask={onCreateTask}
                    />
                  ))}
                </div>
                <TaskDragOverlay
                  draggingTask={draggingTask}
                  renderAssignees={renderAssignees}
                />
              </DndContext>
            </div>
          </div>
          <LoadingScrim visible={loadingVisible} />
        </div>
      )}
    </TabsContent>
  )
}
