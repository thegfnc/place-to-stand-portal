import { useDroppable } from '@dnd-kit/core'

import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'

import { TaskCard } from '../task-card'

type KanbanColumnProps = {
  columnId: string
  label: string
  tasks: TaskWithRelations[]
  canManage: boolean
  renderAssignees: (
    task: TaskWithRelations
  ) => Array<{ id: string; name: string }>
  onEditTask: (task: TaskWithRelations) => void
  activeTaskId: string | null
}

export function KanbanColumn({
  columnId,
  label,
  tasks,
  canManage,
  renderAssignees,
  onEditTask,
  activeTaskId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-background/80 flex h-full min-h-0 w-80 shrink-0 flex-col gap-4 overflow-hidden rounded-xl border p-4 shadow-sm transition',
        isOver && 'ring-primary ring-2'
      )}
    >
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            {label}
          </h2>
        </div>
        <span className='text-muted-foreground text-xs'>{tasks.length}</span>
      </div>
      <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1'>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            assignees={renderAssignees(task)}
            onEdit={onEditTask}
            draggable={canManage}
            isActive={task.id === activeTaskId}
          />
        ))}
      </div>
    </div>
  )
}
