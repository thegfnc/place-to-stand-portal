import { DndContext, type DndContextProps } from '@dnd-kit/core'

import { TabsContent } from '@/components/ui/tabs'
import { BacklogSection } from '../backlog-section'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { TaskDragOverlay } from '../task-drag-overlay'
import { LoadingScrim } from './loading-scrim'
import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import { BACKLOG_SECTIONS } from '@/lib/projects/board/board-constants'
import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'
import type { ProjectsBoardActiveProject } from './board-tab-content'

export type BacklogTabContentProps = {
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
  onDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  scrimLocked: boolean
  isPending: boolean
  activeSheetTaskId: string | null
}

export function BacklogTabContent(props: BacklogTabContentProps) {
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
    onDragEnd,
    draggingTask,
    scrimLocked,
    isPending,
    activeSheetTaskId,
  } = props

  if (!isActive) {
    return null
  }

  const loadingVisible = isPending && !scrimLocked

  return (
    <TabsContent
      value='backlog'
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
            onDragEnd={onDragEnd}
          >
            <div className='flex min-h-0 flex-1 flex-col gap-4'>
              <BacklogSection
                status={BACKLOG_SECTIONS[0].id}
                label='On Deck'
                tasks={onDeckTasks}
                canManage={canManageTasks}
                renderAssignees={renderAssignees}
                onEditTask={onEditTask}
                activeTaskId={activeSheetTaskId}
                onCreateTask={onCreateTask}
              />
              <BacklogSection
                status={BACKLOG_SECTIONS[1].id}
                label='Backlog'
                tasks={backlogTasks}
                canManage={canManageTasks}
                renderAssignees={renderAssignees}
                onEditTask={onEditTask}
                activeTaskId={activeSheetTaskId}
                onCreateTask={onCreateTask}
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
