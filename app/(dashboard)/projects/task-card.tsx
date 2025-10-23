'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import { CalendarDays, Users2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'

type AssigneeInfo = {
  id: string
  name: string
}

type TaskCardProps = {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  onEdit: (task: TaskWithRelations) => void
  draggable: boolean
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-primary/10 text-primary',
  HIGH: 'bg-destructive/10 text-destructive',
}

function CardContent({
  task,
  assignees,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
}) {
  const assignedSummary = assignees.length
    ? assignees
        .slice(0, 2)
        .map(assignee => assignee.name)
        .join(', ')
    : 'Unassigned'

  return (
    <>
      <div className='flex items-start justify-between gap-3'>
        <h3 className='text-foreground line-clamp-2 text-sm leading-snug font-semibold'>
          {task.title}
        </h3>
        <Badge
          variant='secondary'
          className={cn('capitalize', PRIORITY_COLOR[task.priority])}
        >
          {task.priority.toLowerCase()}
        </Badge>
      </div>
      {task.description ? (
        <p className='text-muted-foreground mt-2 line-clamp-3 text-xs'>
          {task.description}
        </p>
      ) : null}
      <div className='text-muted-foreground mt-4 flex flex-wrap items-center gap-3 text-xs'>
        <span className='inline-flex items-center gap-1'>
          <Users2 className='h-3.5 w-3.5' /> {assignedSummary}
        </span>
        {task.due_on ? (
          <span className='inline-flex items-center gap-1'>
            <CalendarDays className='h-3.5 w-3.5' />
            {task.due_on}
          </span>
        ) : null}
      </div>
    </>
  )
}

export function TaskCard({
  task,
  assignees,
  onEdit,
  draggable,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      disabled: !draggable,
      data: {
        type: 'task',
        taskId: task.id,
        projectId: task.project_id,
      },
    })

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cleanedAttributes = useMemo(() => {
    if (!attributes) {
      return {}
    }

    const { ['aria-describedby']: _omitDescribedBy, ...rest } = attributes
    void _omitDescribedBy
    return rest
  }, [attributes])

  const style: CSSProperties = {
    opacity: isDragging ? 0 : 1,
    transform:
      !isDragging && transform ? CSS.Translate.toString(transform) : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isMounted ? attributes : cleanedAttributes)}
      {...listeners}
      role='button'
      onClick={() => onEdit(task)}
      className={cn(
        'group bg-card rounded-lg border p-4 text-left shadow-sm transition',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'ring-primary ring-2'
      )}
    >
      <CardContent task={task} assignees={assignees} />
    </div>
  )
}

export function TaskCardPreview({
  task,
  assignees,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
}) {
  return (
    <div className='bg-card w-80 rounded-lg border p-4 shadow-sm'>
      <CardContent task={task} assignees={assignees} />
    </div>
  )
}
