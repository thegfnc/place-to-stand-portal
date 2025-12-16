import { Fragment } from 'react'
import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BoardDropPlaceholder } from '@/components/board/drop-placeholder'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'

import { TaskCard, type TaskContextDetails } from '../task-card'

type TaskCardOptions = {
  context?: TaskContextDetails
  hideAssignees?: boolean
}

type KanbanColumnProps = {
  columnId: BoardColumnId
  label: string
  tasks: TaskWithRelations[]
  canManage: boolean
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string; avatarUrl: string | null }>
  onEditTask: (task: TaskWithRelations) => void
  activeTaskId: string | null
  onCreateTask?: (status: BoardColumnId) => void
  enableCreateButton?: boolean
  isDropTarget?: boolean
  dropIndicatorIndex?: number | null
  draggingTask?: TaskWithRelations | null
  recentlyMovedTaskId?: string | null
  getTaskCardOptions?: (task: TaskWithRelations) => TaskCardOptions | undefined
}

export function KanbanColumn({
  columnId,
  label,
  tasks,
  canManage,
  renderAssignees,
  onEditTask,
  activeTaskId,
  onCreateTask,
  enableCreateButton,
  isDropTarget = false,
  dropIndicatorIndex = null,
  draggingTask = null,
  recentlyMovedTaskId = null,
  getTaskCardOptions,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      columnId,
    },
  })
  const statusToken = getTaskStatusToken(columnId)
  const statusLabel = getTaskStatusLabel(columnId)
  const displayLabel = label || statusLabel
  const highlight = isOver || isDropTarget
  const draggingTaskVisibleInColumn =
    draggingTask !== null && tasks.some(task => task.id === draggingTask.id)
  const showPlaceholder =
    dropIndicatorIndex !== null &&
    draggingTask !== null &&
    !draggingTaskVisibleInColumn

  const canShowCreateButton =
    typeof enableCreateButton === 'boolean' ? enableCreateButton : canManage

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-background/80 flex min-h-0 w-80 shrink-0 flex-col gap-4 overflow-hidden rounded-xl border p-4 shadow-sm transition',
        highlight && 'ring-primary ring-2'
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-3'>
          <Badge
            variant='outline'
            className={cn(
              'text-xs font-semibold tracking-wide uppercase',
              statusToken
            )}
          >
            {displayLabel}
          </Badge>
          <span className='text-muted-foreground text-[10px]'>
            {tasks.length}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          {canShowCreateButton && onCreateTask ? (
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='h-7 w-7'
              onClick={() => onCreateTask(columnId as BoardColumnId)}
            >
              <Plus className='h-4 w-4' />
              <span className='sr-only'>Add task to {label}</span>
            </Button>
          ) : null}
        </div>
      </div>
      <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1'>
        <SortableContext
          id={columnId}
          items={tasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task, index) => {
            const shouldShowPlaceholder =
              showPlaceholder && dropIndicatorIndex === index

            const cardOptions = getTaskCardOptions?.(task) ?? {}

            return (
              <Fragment key={task.id}>
                {shouldShowPlaceholder ? <BoardDropPlaceholder /> : null}
                <TaskCard
                  task={task}
                  assignees={renderAssignees(task)}
                  onEdit={onEditTask}
                  draggable={canManage}
                  isActive={task.id === activeTaskId}
                  disableDropTransition={task.id === recentlyMovedTaskId}
                  context={cardOptions.context}
                  hideAssignees={cardOptions.hideAssignees}
                />
              </Fragment>
            )
          })}
          {showPlaceholder &&
          dropIndicatorIndex !== null &&
          dropIndicatorIndex >= tasks.length ? (
            <BoardDropPlaceholder key={`${columnId}-placeholder`} />
          ) : null}
        </SortableContext>
      </div>
    </div>
  )
}
