import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'

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
  onCreateTask?: (status: BoardColumnId) => void
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
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })
  const statusToken = getTaskStatusToken(columnId)
  const statusLabel = getTaskStatusLabel(columnId)
  const displayLabel = label || statusLabel

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-background/80 flex min-h-0 w-80 shrink-0 flex-col gap-4 overflow-hidden rounded-xl border p-4 shadow-sm transition',
        isOver && 'ring-primary ring-2'
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
          {canManage && onCreateTask ? (
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
