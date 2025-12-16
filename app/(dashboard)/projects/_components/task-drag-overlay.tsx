import { DragOverlay } from '@dnd-kit/core'

import type { TaskWithRelations } from '@/lib/types'

import { TaskCardPreview, type TaskContextDetails } from '../task-card'
import { CalendarTaskCardPreview } from './projects-board/calendar-task-card-shell'

type TaskDragOverlayProps = {
  draggingTask: TaskWithRelations | null
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string; avatarUrl: string | null }>
  variant?: 'board' | 'calendar'
  getTaskCardOptions?: (
    task: TaskWithRelations
  ) =>
    | {
        context?: TaskContextDetails
        hideAssignees?: boolean
      }
    | undefined
}

export function TaskDragOverlay({
  draggingTask,
  renderAssignees,
  variant = 'board',
  getTaskCardOptions,
}: TaskDragOverlayProps) {
  const assignees = draggingTask ? renderAssignees(draggingTask) : []
  const options = draggingTask ? getTaskCardOptions?.(draggingTask) ?? {} : {}

  return (
    <DragOverlay dropAnimation={null}>
      {draggingTask ? (
        variant === 'calendar' ? (
          <CalendarTaskCardPreview task={draggingTask} assignees={assignees} />
        ) : (
          <TaskCardPreview
            task={draggingTask}
            assignees={assignees}
            context={options.context}
            hideAssignees={options.hideAssignees}
          />
        )
      ) : null}
    </DragOverlay>
  )
}
