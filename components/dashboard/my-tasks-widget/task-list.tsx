import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FolderKanban,
  User,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { AssignedTaskSummary } from '@/lib/data/tasks'
import type { ProjectTypeValue } from '@/lib/types'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'

type TaskListProps = {
  items: AssignedTaskSummary[]
}

type TaskLinkMeta = {
  href: string | null
  reason?: string
}

export function TaskList({ items }: TaskListProps) {
  return (
    <ul className='divide-border flex h-full flex-col divide-y'>
      {items.map(task => (
        <TaskListItem key={task.id} task={task} />
      ))}
    </ul>
  )
}

function TaskListItem({ task }: { task: AssignedTaskSummary }) {
  const dueMeta = getTaskDueMeta(task.dueOn, { status: task.status })
  const linkMeta = getTaskLinkMeta(task)
  const projectLinkMeta = getProjectLinkMeta(task)
  const clientLinkMeta = getClientLinkMeta(task)
  const statusToken = getTaskStatusToken(task.status)
  const statusLabel = getTaskStatusLabel(task.status)
  const hasTaskLink = Boolean(linkMeta.href)
  const clientLabel = getClientDisplayName(task)

  return (
    <li className={cn('relative', hasTaskLink && 'group')}>
      {hasTaskLink ? (
        <Link
          href={linkMeta.href!}
          className='hover:bg-muted/60 focus-visible:ring-primary focus-visible:ring-offset-background absolute inset-0 z-0 rounded-lg px-5 py-4 transition focus-visible:ring-2 focus-visible:ring-offset-2'
          aria-label={`View task: ${task.title}`}
        />
      ) : null}
      <article
        className={cn(
          'relative z-10 flex items-start gap-3 px-5 py-4',
          hasTaskLink && 'pointer-events-none'
        )}
      >
        <div className='flex-1 space-y-2'>
          {hasTaskLink ? (
            <span className='text-foreground group-hover:text-primary line-clamp-2 text-sm font-semibold underline-offset-4 transition'>
              {task.title}
            </span>
          ) : (
            <span className='text-muted-foreground line-clamp-2 text-sm font-semibold'>
              {task.title}
            </span>
          )}
          <div className='flex flex-wrap items-center gap-2 text-xs'>
            <Badge
              variant='outline'
              className={cn(
                'text-[10px] font-semibold tracking-wide uppercase',
                statusToken
              )}
            >
              {statusLabel}
            </Badge>
            <div className='text-muted-foreground inline-flex items-center gap-3'>
              {clientLinkMeta.href ? (
                <Link
                  href={clientLinkMeta.href}
                  onClick={e => e.stopPropagation()}
                  className='hover:text-foreground pointer-events-auto relative z-20 inline-flex items-center gap-1 underline-offset-4 transition hover:underline'
                >
                  {renderProjectTypeIcon(task.project.type, 'size-3.5')}
                  {clientLabel}
                </Link>
              ) : (
                <span className='inline-flex items-center gap-1'>
                  {renderProjectTypeIcon(task.project.type, 'size-3.5')}
                  {clientLabel}
                </span>
              )}
              {projectLinkMeta.href ? (
                <Link
                  href={projectLinkMeta.href}
                  onClick={e => e.stopPropagation()}
                  className='hover:text-foreground pointer-events-auto relative z-20 inline-flex items-center gap-1 underline-offset-4 transition hover:underline'
                >
                  <FolderKanban className='size-3.5' aria-hidden />
                  {task.project.name}
                </Link>
              ) : (
                <span className='inline-flex items-center gap-1'>
                  <FolderKanban className='size-3.5' aria-hidden />
                  {task.project.name}
                </span>
              )}
              <div
                className={cn(
                  'inline-flex items-center gap-1',
                  TASK_DUE_TONE_CLASSES[dueMeta.tone]
                )}
              >
                <CalendarDays className='size-3.5' aria-hidden />
                {dueMeta.label}
              </div>
            </div>
          </div>
        </div>
        {hasTaskLink ? (
          <ChevronRight
            className='text-muted-foreground size-4 shrink-0 self-center'
            aria-hidden
          />
        ) : null}
      </article>
      {linkMeta.reason ? (
        <p className='text-muted-foreground relative z-10 px-5 pt-2 pb-4 text-xs'>
          {linkMeta.reason}
        </p>
      ) : null}
    </li>
  )
}

function getTaskLinkMeta(task: AssignedTaskSummary): TaskLinkMeta {
  return {
    href: `/my-tasks/board/${task.id}`,
  }
}

function getProjectLinkMeta(task: AssignedTaskSummary): TaskLinkMeta {
  const { client, project } = task
  const projectSlug = project.slug ?? null

  if (!projectSlug) {
    return { href: null }
  }

  if (project.type === 'INTERNAL') {
    return {
      href: `/projects/${PROJECT_SPECIAL_SEGMENTS.INTERNAL}/${projectSlug}/board`,
    }
  }

  if (project.type === 'PERSONAL') {
    return {
      href: `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${projectSlug}/board`,
    }
  }

  const clientSlug = client?.slug ?? null

  if (!clientSlug) {
    return { href: null }
  }

  return {
    href: `/projects/${clientSlug}/${projectSlug}/board`,
  }
}

function getClientLinkMeta(task: AssignedTaskSummary): TaskLinkMeta {
  const { client, project } = task

  // Only link to client pages for CLIENT-type projects with a valid client
  if (project.type !== 'CLIENT' || !client) {
    return { href: null }
  }

  const clientSlug = client.slug
  if (clientSlug) {
    return { href: `/clients/${clientSlug}` }
  }

  return { href: `/clients/${client.id}` }
}

function getClientDisplayName(task: AssignedTaskSummary): string {
  if (task.client?.name) {
    return task.client.name
  }

  if (task.project.type === 'PERSONAL') {
    return 'Personal'
  }

  if (task.project.type === 'INTERNAL') {
    return 'Internal'
  }

  return 'Unassigned'
}

function renderProjectTypeIcon(
  projectType: ProjectTypeValue,
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
