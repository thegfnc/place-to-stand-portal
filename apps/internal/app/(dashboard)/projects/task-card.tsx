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
  Bot,
  Building2,
  CalendarDays,
  Clock,
  FolderKanban,
  MessageCircle,
  Paperclip,
  User,
  Users,
} from 'lucide-react'

import {
  CardAssigneeAvatars,
  type CardAssignee,
} from '@/components/cards/card-assignee-avatars'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'
import type {
  ProjectTypeValue,
  TaskWithRelations,
  WorkerStatusValue,
} from '@/lib/types'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'

type AssigneeInfo = CardAssignee

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
}

/**
 * Hours read as a compact chip, so `3` not `3.00` and `3.5` not `3.50` —
 * the card has room for a glance, not a ledger.
 */
const formatLoggedHours = (value: number) =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}h`

function CardContent({
  task,
  assignees,
  context,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  context?: TaskContextDetails
}) {
  const attachmentCount = task.attachmentCount ?? task.attachments?.length ?? 0
  const loggedHours = task.loggedHours ?? 0
  const dueMeta = task.due_on
    ? getTaskDueMeta(task.due_on, { status: task.status })
    : null
  const isCompleted = task.status === 'DONE'

  return (
    <>
      <h3
        className={cn(
          'text-foreground line-clamp-2 text-sm leading-snug font-semibold',
          isCompleted && 'line-through'
        )}
      >
        {task.title}
      </h3>
      {/* Meta stacks down the left; the assignee stack pins bottom-right so
          it never adds a row of its own. */}
      <div className='mt-4 flex items-end justify-between gap-3'>
        <div className='flex min-w-0 flex-1 flex-col gap-2'>
          {context?.clientLabel || context?.projectLabel ? (
            <div
              className={cn(
                'text-muted-foreground text-xs',
                context.layout === 'stacked'
                  ? 'flex flex-col items-start gap-2'
                  : 'flex flex-wrap items-center gap-3'
              )}
            >
              {context.clientLabel ? (
                context.clientHref ? (
                  <div className='flex items-center gap-1'>
                    <Link
                      href={context.clientHref}
                      className='hover:text-foreground inline-flex items-center gap-1 underline-offset-4 transition hover:underline'
                      onClick={event => event.stopPropagation()}
                    >
                      {renderProjectTypeIcon(
                        context?.projectType,
                        'h-3.5 w-3.5'
                      )}
                      {context.clientLabel}
                    </Link>
                  </div>
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
          {task.commentCount > 0 || attachmentCount > 0 || loggedHours > 0 ? (
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
              {loggedHours > 0 ? (
                <span
                  className='inline-flex items-center gap-1'
                  title={`${formatLoggedHours(loggedHours)} logged`}
                >
                  <Clock className='h-3.5 w-3.5' aria-hidden />
                  {formatLoggedHours(loggedHours)}
                </span>
              ) : null}
            </div>
          ) : null}
          {task.worker_status ? (
            <WorkerBadge status={task.worker_status} />
          ) : null}
        </div>
        <CardAssigneeAvatars assignees={assignees} />
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

  const isCompleted = task.status === 'DONE'
  const shouldDisableTransition = disableDropTransition && !isDragging
  const style: CSSProperties = {
    opacity: isDragging ? 0 : isCompleted ? 0.65 : 1,
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
        !isActive && !isDragging && !isCompleted && ENTITY_ACCENTS.task.card,
        !isActive &&
          !isDragging &&
          isCompleted &&
          'hover:border-muted-foreground/30 hover:bg-muted/20 hover:shadow-md'
      )}
    >
      <CardContent task={task} assignees={assignees} context={context} />
    </div>
  )
}

/**
 * The board card without the board: no dnd-kit (useSortable needs the board's
 * DndContext), no fixed width — a plain clickable card for surfaces like the
 * lead sheet's Tasks section that want board-identical rendering.
 */
export function TaskCardStatic({
  task,
  assignees,
  onClick,
  className,
  context,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  onClick: () => void
  className?: string
  context?: TaskContextDetails
}) {
  const isCompleted = task.status === 'DONE'

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group bg-card cursor-pointer rounded-lg border p-4 text-left shadow-sm transition',
        isCompleted
          ? 'hover:border-muted-foreground/30 hover:bg-muted/20 opacity-65 hover:shadow-md'
          : ENTITY_ACCENTS.task.card,
        className
      )}
    >
      <CardContent task={task} assignees={assignees} context={context} />
    </div>
  )
}

export function TaskCardPreview({
  task,
  assignees,
  context,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  context?: TaskContextDetails
}) {
  const isCompleted = task.status === 'DONE'
  return (
    <div
      className={cn(
        'bg-card w-80 rounded-lg border p-4 shadow-sm',
        isCompleted ? 'opacity-65' : ENTITY_ACCENTS.task.cardStatic
      )}
    >
      <CardContent task={task} assignees={assignees} context={context} />
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

const WORKER_BADGE_CONFIG: Partial<
  Record<WorkerStatusValue, { label: string; className: string }>
> = {
  dispatched: {
    label: 'Dispatched',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  working: {
    label: 'Executing',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  implementing: {
    label: 'Executing',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  plan_ready: {
    label: 'Plan Ready',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  pr_created: {
    label: 'PR Created',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
  cancelled: {
    label: 'Cancelled',
    className:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  },
}

function WorkerBadge({ status }: { status: WorkerStatusValue }) {
  const config = WORKER_BADGE_CONFIG[status]
  if (!config) return null
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        config.className
      )}
    >
      <Bot className='h-3 w-3' />
      {config.label}
    </span>
  )
}

export type { TaskContextDetails }
