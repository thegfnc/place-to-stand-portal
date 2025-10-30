'use client'

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import { CalendarDays, MessageCircle, Paperclip, Users2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'

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
  const dueMeta = task.due_on
    ? getTaskDueMeta(task.due_on, { status: task.status })
    : null

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
          <div className='inline-flex items-center gap-1'>
            <Users2 className='h-3.5 w-3.5' /> {assignedSummary}
          </div>
        </div>

        {dueMeta ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-xs'>
            <div
              className={cn(
                'inline-flex items-center gap-1',
                TASK_DUE_TONE_CLASSES[dueMeta.tone]
              )}
            >
              <CalendarDays className='h-3.5 w-3.5' />
              {dueMeta.label}
            </div>
          </div>
        ) : null}
        {task.commentCount > 0 || attachmentCount > 0 ? (
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
  const listenersMap = listeners ?? {}
  const draggableKeyDown = (
    listenersMap as {
      onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
    }
  ).onKeyDown
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
      {...listenersMap}
      role='button'
      onClick={() => onEdit(task)}
      onKeyDown={event => {
        draggableKeyDown?.(event)
        if (event.defaultPrevented) {
          return
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEdit(task)
        }
      }}
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
