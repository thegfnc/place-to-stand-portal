'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import {
  Building2,
  CalendarDays,
  FolderKanban,
  MessageCircle,
  Paperclip,
  User,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ProjectTypeValue, TaskWithRelations } from '@/lib/types'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'

type AssigneeInfo = {
  id: string
  name: string
}

type TaskContextDetails = {
  clientLabel?: string
  clientHref?: string | null
  projectLabel?: string
  projectHref?: string | null
  layout?: 'inline' | 'stacked'
  projectType?: ProjectTypeValue
}

type TaskCardProps = {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  onEdit: (task: TaskWithRelations) => void
  draggable: boolean
  isActive?: boolean
  disableDropTransition?: boolean
  context?: TaskContextDetails
  hideAssignees?: boolean
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
  context,
  hideAssignees = false,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  context?: TaskContextDetails
  hideAssignees?: boolean
}) {
  const assignedSummary = assignees.length
    ? assignees
        .slice(0, 2)
        .map(assignee => assignee.name)
        .join(', ')
    : 'Unassigned'
  const descriptionPreview = toPlainText(task.description)
  const attachmentCount = task.attachmentCount ?? task.attachments?.length ?? 0
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
        {!hideAssignees ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-xs'>
            <div className='inline-flex items-center gap-1'>
              <User className='h-3.5 w-3.5' /> {assignedSummary}
            </div>
          </div>
        ) : null}

        {context?.clientLabel || context?.projectLabel ? (
          <div
            className={cn(
              'text-muted-foreground text-xs',
              context.layout === 'stacked'
                ? 'align-start flex flex-col gap-2'
                : 'flex flex-wrap items-center gap-3'
            )}
          >
            {context.clientLabel ? (
              context.clientHref ? (
                <Link
                  href={context.clientHref}
                  className='hover:text-foreground inline-flex items-center gap-1 underline-offset-4 transition hover:underline'
                  onClick={event => event.stopPropagation()}
                >
                  {renderProjectTypeIcon(context?.projectType, 'h-3.5 w-3.5')}
                  {context.clientLabel}
                </Link>
              ) : (
                <span className='inline-flex items-center gap-1'>
                  {renderProjectTypeIcon(context?.projectType, 'h-3.5 w-3.5')}
                  {context.clientLabel}
                </span>
              )
            ) : null}
            {context.projectLabel ? (
              context.projectHref ? (
                <div className='flex items-center gap-1'>
                  <Link
                    href={context.projectHref}
                    className='hover:text-foreground inline-flex items-center gap-1 underline-offset-4 transition hover:underline'
                    onClick={event => event.stopPropagation()}
                  >
                    <FolderKanban className='h-3.5 w-3.5' aria-hidden />
                    {context.projectLabel}
                  </Link>
                </div>
              ) : (
                <span className='inline-flex items-center gap-1'>
                  <FolderKanban className='h-3.5 w-3.5' aria-hidden />
                  {context.projectLabel}
                </span>
              )
            ) : null}
          </div>
        ) : null}
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
  disableDropTransition = false,
  context,
  hideAssignees = false,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !draggable,
    data: {
      type: 'task',
      taskId: task.id,
      projectId: task.project_id,
      columnId: task.status,
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

  const shouldDisableTransition = disableDropTransition && !isDragging
  const style: CSSProperties = {
    opacity: isDragging ? 0 : 1,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: shouldDisableTransition
      ? 'none'
      : isDragging
        ? undefined
        : transition,
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
      <CardContent
        task={task}
        assignees={assignees}
        context={context}
        hideAssignees={hideAssignees}
      />
    </div>
  )
}

export function TaskCardPreview({
  task,
  assignees,
  context,
  hideAssignees = false,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  context?: TaskContextDetails
  hideAssignees?: boolean
}) {
  return (
    <div className='bg-card w-80 rounded-lg border p-4 shadow-sm'>
      <CardContent
        task={task}
        assignees={assignees}
        context={context}
        hideAssignees={hideAssignees}
      />
    </div>
  )
}

function renderProjectTypeIcon(
  projectType: ProjectTypeValue | undefined,
  className: string
) {
  if (projectType === 'INTERNAL') {
    return <Users className={className} aria-hidden />
  }

  if (projectType === 'PERSONAL') {
    return <User className={className} aria-hidden />
  }

  return <Building2 className={className} aria-hidden />
}

export type { TaskContextDetails }
