import { useCallback, useRef, type RefObject, type UIEventHandler } from 'react'
import {
  DndContext,
  type CollisionDetection,
  type DndContextProps,
  type UniqueIdentifier,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'

import { TabsContent } from '@/components/ui/tabs'
import { KanbanColumn } from '../kanban-column'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { TaskDragOverlay } from '../task-drag-overlay'

import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import {
  BOARD_COLUMNS,
  type BoardColumnId,
} from '@/lib/projects/board/board-constants'
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
  onDragOver: DndContextProps['onDragOver']
  onDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  boardViewportRef: RefObject<HTMLDivElement | null>
  onBoardScroll: UIEventHandler<HTMLDivElement>
  activeSheetTaskId: string | null
  activeDropColumnId: BoardColumnId | null
  dropPreview: { columnId: BoardColumnId; index: number } | null
  recentlyMovedTaskId: string | null
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
    onDragOver,
    onDragEnd,
    draggingTask,
    boardViewportRef,
    onBoardScroll,
    activeSheetTaskId,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
  } = props

  const lastTaskOverId = useRef<UniqueIdentifier | null>(null)
  const lastColumnOverId = useRef<UniqueIdentifier | null>(null)

  type CollisionArgs = Parameters<CollisionDetection>[0]

  const findDroppable = useCallback(
    (
      id: UniqueIdentifier,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => droppableContainers.find(container => container.id === id),
    []
  )

  const prioritizeCollisions = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      if (collisions.length < 2) {
        return collisions
      }

      const taskCollisions = collisions.filter(collision => {
        const container = findDroppable(collision.id, droppableContainers)
        return container?.data?.current?.type === 'task'
      })

      if (taskCollisions.length > 0) {
        return taskCollisions
      }

      return collisions
    },
    [findDroppable]
  )

  const rememberTaskCollision = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      const first = collisions[0]

      if (!first) {
        return
      }

      const container = findDroppable(first.id, droppableContainers)

      if (container?.data?.current?.type === 'task') {
        lastTaskOverId.current = first.id
      }
    },
    [findDroppable]
  )

  const rememberColumnCollision = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      for (const collision of collisions) {
        const container = findDroppable(collision.id, droppableContainers)

        if (container?.data?.current?.type === 'column') {
          lastColumnOverId.current = collision.id
          return
        }
      }
    },
    [findDroppable]
  )

  const fallbackToLastTask = useCallback(
    (droppableContainers: CollisionArgs['droppableContainers']) => {
      if (!lastTaskOverId.current) {
        return null
      }

      const container = findDroppable(
        lastTaskOverId.current,
        droppableContainers
      )

      if (!container) {
        lastTaskOverId.current = null
        return null
      }

      return [{ id: lastTaskOverId.current }]
    },
    [findDroppable]
  )

  const fallbackToLastColumn = useCallback(
    (droppableContainers: CollisionArgs['droppableContainers']) => {
      if (!lastColumnOverId.current) {
        return null
      }

      const container = findDroppable(
        lastColumnOverId.current,
        droppableContainers
      )

      if (!container) {
        lastColumnOverId.current = null
        return null
      }

      return [{ id: lastColumnOverId.current }]
    },
    [findDroppable]
  )

  const collisionDetection = useCallback<CollisionDetection>(
    args => {
      const pointerCollisions = pointerWithin(args)

      if (pointerCollisions.length > 0) {
        const prioritized = prioritizeCollisions(
          pointerCollisions,
          args.droppableContainers
        )

        rememberTaskCollision(prioritized, args.droppableContainers)
        rememberColumnCollision(pointerCollisions, args.droppableContainers)

        return prioritized
      }

      const intersections = rectIntersection(args)

      if (intersections.length > 0) {
        const prioritized = prioritizeCollisions(
          intersections,
          args.droppableContainers
        )

        rememberTaskCollision(prioritized, args.droppableContainers)
        rememberColumnCollision(intersections, args.droppableContainers)

        return prioritized
      }

      const taskFallback = fallbackToLastTask(args.droppableContainers)

      if (taskFallback) {
        return taskFallback
      }

      const columnFallback = fallbackToLastColumn(args.droppableContainers)

      if (columnFallback) {
        return columnFallback
      }

      return closestCenter(args)
    },
    [
      fallbackToLastTask,
      fallbackToLastColumn,
      prioritizeCollisions,
      rememberTaskCollision,
      rememberColumnCollision,
    ]
  )

  if (!isActive) {
    return null
  }

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
                onDragStart={event => {
                  lastTaskOverId.current = null
                  lastColumnOverId.current = null
                  onDragStart?.(event)
                }}
                onDragOver={onDragOver}
                onDragEnd={event => {
                  lastTaskOverId.current = null
                  lastColumnOverId.current = null
                  onDragEnd?.(event)
                }}
                collisionDetection={collisionDetection}
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
                      isDropTarget={activeDropColumnId === column.id}
                      dropIndicatorIndex={
                        dropPreview?.columnId === column.id
                          ? dropPreview.index
                          : null
                      }
                      draggingTask={draggingTask}
                      recentlyMovedTaskId={recentlyMovedTaskId}
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
        </div>
      )}
    </TabsContent>
  )
}
