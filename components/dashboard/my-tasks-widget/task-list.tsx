import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FolderKanban,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { AssignedTaskSummary } from '@/lib/data/tasks'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'

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
              <div className='flex items-center gap-1'>
                <Building2 className='size-3.5' aria-hidden />
                {clientLabel}
              </div>
              <div className='flex items-center gap-1'>
                <FolderKanban className='size-3.5' aria-hidden />
                {projectLinkMeta.href ? (
                  <Link
                    href={projectLinkMeta.href}
                    onClick={e => e.stopPropagation()}
                    className='hover:text-foreground pointer-events-auto relative z-20 underline-offset-4 transition-colors hover:underline'
                  >
                    {task.project.name}
                  </Link>
                ) : (
                  task.project.name
                )}
              </div>
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
    href: `/my-tasks/${task.id}`,
  }
}

function getProjectLinkMeta(task: AssignedTaskSummary): TaskLinkMeta {
  const { client, project } = task

  if (!project.slug || !client?.slug) {
    return {
      href: null,
    }
  }

  return {
    href: `/projects/${client.slug}/${project.slug}/board`,
  }
}

function getClientDisplayName(task: AssignedTaskSummary): string {
  if (task.client?.name) {
    return task.client.name
  }

  if (task.project.isPersonal) {
    return 'Personal'
  }

  if (task.project.isInternal) {
    return 'Internal'
  }

  return 'Unassigned'
}
