import { useCallback, useRef } from 'react'
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
import { RefineSection } from '../refine-section'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { TaskDragOverlay } from '../task-drag-overlay'
import { LoadingScrim } from './loading-scrim'
import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import {
  BACKLOG_SECTIONS,
  type BoardColumnId,
} from '@/lib/projects/board/board-constants'
import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'
import type { ProjectsBoardActiveProject } from './board-tab-content'

const ON_DECK_SECTION_DESCRIPTION =
  'Tasks that have been refined and are queued for development.'

const BACKLOG_SECTION_DESCRIPTION =
  'Ideas and requests waiting to be refined for upcoming cycles.'

export type RefineTabContentProps = {
  isActive: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  onDeckTasks: TaskWithRelations[]
  backlogTasks: TaskWithRelations[]
  canManageTasks: boolean
  renderAssignees: RenderAssigneeFn
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  sensors: DndContextProps['sensors']
  onDragStart: DndContextProps['onDragStart']
  onDragOver: DndContextProps['onDragOver']
  onDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  scrimLocked: boolean
  isPending: boolean
  activeSheetTaskId: string | null
  activeDropColumnId: BoardColumnId | null
}

export function RefineTabContent(props: RefineTabContentProps) {
  const {
    isActive,
    feedback,
    activeProject,
    onDeckTasks,
    backlogTasks,
    canManageTasks,
    renderAssignees,
    onEditTask,
    onCreateTask,
    sensors,
    onDragStart,
    onDragOver,
    onDragEnd,
    draggingTask,
    scrimLocked,
    isPending,
    activeSheetTaskId,
    activeDropColumnId,
  } = props

  const lastOverId = useRef<UniqueIdentifier | null>(null)

  const collisionDetection = useCallback<CollisionDetection>(args => {
    const pointerCollisions = pointerWithin(args)

    if (pointerCollisions.length > 0) {
      lastOverId.current = pointerCollisions[0].id
      return pointerCollisions
    }

    const intersections = rectIntersection(args)

    if (intersections.length > 0) {
      lastOverId.current = intersections[0].id
      return intersections
    }

    if (lastOverId.current) {
      return [{ id: lastOverId.current }]
    }

    return closestCenter(args)
  }, [])

  if (!isActive) {
    return null
  }

  const loadingVisible = isPending && !scrimLocked

  return (
    <TabsContent
      value='refine'
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
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={event => {
              lastOverId.current = null
              onDragEnd?.(event)
            }}
            collisionDetection={collisionDetection}
          >
            <div className='flex min-h-0 flex-1 flex-col gap-4'>
              <RefineSection
                status={BACKLOG_SECTIONS[0].id}
                label='On Deck'
                tasks={onDeckTasks}
                canManage={canManageTasks}
                renderAssignees={renderAssignees}
                onEditTask={onEditTask}
                activeTaskId={activeSheetTaskId}
                onCreateTask={onCreateTask}
                description={ON_DECK_SECTION_DESCRIPTION}
                isDropTarget={activeDropColumnId === BACKLOG_SECTIONS[0].id}
              />
              <RefineSection
                status={BACKLOG_SECTIONS[1].id}
                label='Backlog'
                tasks={backlogTasks}
                canManage={canManageTasks}
                renderAssignees={renderAssignees}
                onEditTask={onEditTask}
                activeTaskId={activeSheetTaskId}
                onCreateTask={onCreateTask}
                description={BACKLOG_SECTION_DESCRIPTION}
                isDropTarget={activeDropColumnId === BACKLOG_SECTIONS[1].id}
              />
            </div>
            <TaskDragOverlay
              draggingTask={draggingTask}
              renderAssignees={renderAssignees}
            />
          </DndContext>
          <LoadingScrim visible={loadingVisible} />
        </div>
      )}
    </TabsContent>
  )
}
