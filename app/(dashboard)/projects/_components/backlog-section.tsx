'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { MessageCircle, Paperclip, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'

const formatDueDate = (value: string | null) => {
  if (!value) {
    return '—'
  }

  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return format(parsed, 'MMM d, yyyy')
  } catch {
    return value
  }
}

const formatUpdatedAt = (value: string) => {
  try {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return formatDistanceToNow(parsed, { addSuffix: true })
  } catch {
    return value
  }
}

type AssigneeInfo = { id: string; name: string }

type BacklogTaskRowProps = {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  onEdit: (task: TaskWithRelations) => void
  draggable: boolean
  isActive?: boolean
}

function BacklogTaskRow({
  task,
  assignees,
  onEdit,
  draggable,
  isActive = false,
}: BacklogTaskRowProps) {
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
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  }

  const assignedSummary = assignees.length
    ? assignees.map(person => person.name).join(', ')
    : 'Unassigned'
  const commentCount = task.commentCount ?? 0
  const attachmentCount = task.attachments.length

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onEdit(task)
      }
    },
    [onEdit, task]
  )

  const tableAttributes = isMounted ? attributes : cleanedAttributes

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      {...tableAttributes}
      {...listeners}
      data-state={isActive ? 'selected' : undefined}
      role='button'
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onEdit(task)}
      className={cn(
        'group focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'ring-primary ring-2',
        (isActive || isDragging) && 'bg-primary/5',
        !isActive && !isDragging && 'hover:bg-muted/50'
      )}
    >
      <TableCell className='py-3 align-top'>
        <div className='flex flex-col gap-1'>
          <span className='text-sm leading-snug font-medium'>{task.title}</span>
          <span className='text-muted-foreground text-xs'>
            {assignedSummary}
          </span>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-center text-xs'>
        {commentCount > 0 ? (
          <span className='inline-flex items-center gap-1'>
            <MessageCircle className='h-3.5 w-3.5' />
            {commentCount}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-center text-xs'>
        {attachmentCount > 0 ? (
          <span className='inline-flex items-center gap-1'>
            <Paperclip className='h-3.5 w-3.5' />
            {attachmentCount}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-sm'>
        {formatDueDate(task.due_on ?? null)}
      </TableCell>
      <TableCell className='text-muted-foreground py-3 text-sm'>
        {formatUpdatedAt(task.updated_at)}
      </TableCell>
    </TableRow>
  )
}

type BacklogSectionProps = {
  status: BoardColumnId
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

export function BacklogSection({
  status,
  label,
  tasks,
  canManage,
  renderAssignees,
  onEditTask,
  activeTaskId,
  onCreateTask,
}: BacklogSectionProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'bg-background rounded-xl border shadow-sm transition',
        isOver && 'ring-primary ring-2'
      )}
    >
      <div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <h3 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            {label}
          </h3>
          <span className='text-muted-foreground text-xs'>{tasks.length}</span>
        </div>
        {canManage && onCreateTask ? (
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='h-7 w-7'
            onClick={() => onCreateTask(status)}
          >
            <Plus className='h-4 w-4' />
            <span className='sr-only'>Add task to {label}</span>
          </Button>
        ) : null}
      </div>
      <div className='px-2 pt-1 pb-2'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/30 hover:bg-muted/30'>
              <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                Task
              </TableHead>
              <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                Comments
              </TableHead>
              <TableHead className='text-muted-foreground text-center text-xs font-semibold uppercase'>
                Files
              </TableHead>
              <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                Due
              </TableHead>
              <TableHead className='text-muted-foreground text-xs font-semibold uppercase'>
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell
                  className='text-muted-foreground py-8 text-center text-sm'
                  colSpan={5}
                >
                  No tasks yet.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map(task => (
                <BacklogTaskRow
                  key={task.id}
                  task={task}
                  assignees={renderAssignees(task)}
                  onEdit={onEditTask}
                  draggable={canManage}
                  isActive={task.id === activeTaskId}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
