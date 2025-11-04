import Link from 'next/link'
import { CalendarDays, ChevronRight, FolderKanban } from 'lucide-react'

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
  const statusToken = getTaskStatusToken(task.status)
  const statusLabel = getTaskStatusLabel(task.status)

  const rowContent = (
    <article className='flex items-start gap-3'>
      <div className='flex-1 space-y-2'>
        {linkMeta.href ? (
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
          <span className='text-muted-foreground inline-flex items-center gap-1'>
            <FolderKanban className='size-3.5' aria-hidden />
            {task.project.name}
            {task.client?.name ? ` / ${task.client.name}` : ''}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1',
              TASK_DUE_TONE_CLASSES[dueMeta.tone]
            )}
          >
            <CalendarDays className='size-3.5' aria-hidden />
            {dueMeta.label}
          </span>
        </div>
      </div>
      {linkMeta.href ? (
        <ChevronRight
          className='text-muted-foreground size-4 shrink-0 self-center'
          aria-hidden
        />
      ) : null}
    </article>
  )

  return (
    <li>
      {linkMeta.href ? (
        <Link
          href={linkMeta.href}
          className='group hover:bg-muted/60 focus-visible:ring-primary focus-visible:ring-offset-background block rounded-lg px-5 py-4 transition focus-visible:ring-2 focus-visible:ring-offset-2'
        >
          {rowContent}
        </Link>
      ) : (
        <div className='px-5 py-4'>{rowContent}</div>
      )}
      {linkMeta.reason ? (
        <p className='text-muted-foreground px-5 pt-2 pb-4 text-xs'>
          {linkMeta.reason}
        </p>
      ) : null}
    </li>
  )
}

function getTaskLinkMeta(task: AssignedTaskSummary): TaskLinkMeta {
  const { client, project } = task

  if (!project.slug || !client?.slug) {
    return {
      href: null,
      reason:
        "This task's project is missing a client or project slug. Update it in Settings -> Projects to enable quick navigation.",
    }
  }

  return {
    href: `/projects/${client.slug}/${project.slug}/board/${task.id}`,
  }
}
