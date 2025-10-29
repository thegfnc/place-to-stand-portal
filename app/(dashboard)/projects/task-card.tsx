'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import { CalendarDays, MessageCircle, Paperclip, Users2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

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
  isActive?: boolean
}

const toPlainText = (value: string | null) => {
  if (!value) {
    return ''
  }

  return value
    .replace(/<br\s*\/?>(\s|&nbsp;|\u00a0)*/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  const descriptionPreview = toPlainText(task.description)
  const attachmentCount = task.attachments.length
  let dueDateLabel: string | null = null

  if (task.due_on) {
    try {
      const parsed = parseISO(task.due_on)
      dueDateLabel = Number.isNaN(parsed.getTime())
        ? task.due_on
        : format(parsed, 'MMM d, yyyy')
    } catch {
      dueDateLabel = task.due_on
    }
  }

  return (
    <>
      <div className='space-y-2'>
        <h3 className='text-foreground line-clamp-2 text-sm leading-snug font-semibold'>
          {task.title}
        </h3>
        {descriptionPreview ? (
          <p className='text-muted-foreground line-clamp-3 text-xs'>
            {descriptionPreview}
          </p>
        ) : null}
      </div>
      <div className='mt-4 space-y-2'>
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-xs'>
          {task.commentCount > 0 ? (
            <span className='inline-flex items-center gap-1'>
              <MessageCircle className='h-3.5 w-3.5' />
              {task.commentCount}
            </span>
          ) : null}
          {attachmentCount > 0 ? (
            <span className='inline-flex items-center gap-1'>
              <Paperclip className='h-3.5 w-3.5' />
              {attachmentCount}
            </span>
          ) : null}
        </div>
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-xs'>
          <span className='inline-flex items-center gap-1'>
            <Users2 className='h-3.5 w-3.5' /> {assignedSummary}
          </span>
          {dueDateLabel ? (
            <span className='inline-flex items-center gap-1'>
              <CalendarDays className='h-3.5 w-3.5' />
              {dueDateLabel}
            </span>
          ) : null}
        </div>
      </div>
    </>
  )
}

export function TaskCard({
  task,
  assignees,
  onEdit,
  draggable,
  isActive = false,
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
        isDragging && 'ring-primary ring-2',
        (isActive || isDragging) && 'border-primary/50 bg-primary/5 shadow-md',
        !isActive &&
          !isDragging &&
          'hover:border-primary/40 hover:bg-primary/5 hover:shadow-md'
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
