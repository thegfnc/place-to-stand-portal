import { DragOverlay } from '@dnd-kit/core'

import type { TaskWithRelations } from '@/lib/types'

import { TaskCardPreview } from '../task-card'
import { CalendarTaskCardPreview } from './projects-board/calendar-task-card-shell'

type TaskDragOverlayProps = {
  draggingTask: TaskWithRelations | null
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string }>
  variant?: 'board' | 'calendar'
}

export function TaskDragOverlay({
  draggingTask,
  renderAssignees,
  variant = 'board',
}: TaskDragOverlayProps) {
  const assignees = draggingTask ? renderAssignees(draggingTask) : []

  return (
    <DragOverlay dropAnimation={null}>
      {draggingTask ? (
        variant === 'calendar' ? (
          <CalendarTaskCardPreview task={draggingTask} assignees={assignees} />
        ) : (
          <TaskCardPreview task={draggingTask} assignees={assignees} />
        )
      ) : null}
    </DragOverlay>
  )
}
