import { DragOverlay } from '@dnd-kit/core'

import type { TaskWithRelations } from '@/lib/types'

import { TaskCardPreview } from '../task-card'

type TaskDragOverlayProps = {
  draggingTask: TaskWithRelations | null
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string }>
}

export function TaskDragOverlay({
  draggingTask,
  renderAssignees,
}: TaskDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {draggingTask ? (
        <TaskCardPreview
          task={draggingTask}
          assignees={renderAssignees(draggingTask)}
        />
      ) : null}
    </DragOverlay>
  )
}
