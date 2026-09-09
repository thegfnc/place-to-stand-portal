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
import { myTaskHref } from '@/lib/sheets/hrefs'
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
          // Full-bleed so the highlight meets the row dividers and the card's own
          // clipped corners; a per-row radius left square gaps at every edge.
          className='hover:bg-muted/60 focus-visible:ring-primary absolute inset-0 z-0 transition focus-visible:ring-2 focus-visible:ring-inset'
          aria-label={`View task: ${task.title}`}
        />
      ) : null}
      <article
        className={cn(
          'relative z-10 flex items-start gap-2 px-4 py-2.5',
          hasTaskLink && 'pointer-events-none'
        )}
      >
        <div className='min-w-0 flex-1 space-y-1'>
          {hasTaskLink ? (
            <span className='text-foreground group-hover:text-primary block truncate text-sm font-semibold underline-offset-4 transition'>
              {task.title}
            </span>
          ) : (
            <span className='text-muted-foreground block truncate text-sm font-semibold'>
              {task.title}
            </span>
          )}
          <div className='flex min-w-0 items-center gap-1.5'>
            <Badge
              variant='outline'
              className={cn(
                'text-[10px] font-semibold tracking-wide uppercase',
                statusToken
              )}
            >
              {statusLabel}
            </Badge>
            {/*
              Meta line matches the time-log rows: 11px text, size-3 icons, and
              a dot between each fragment so they read as one breadcrumb rather
              than three floating chips.
            */}
            <div className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11px]'>
              {clientLinkMeta.href ? (
                <Link
                  href={clientLinkMeta.href}
                  onClick={e => e.stopPropagation()}
                  className='hover:text-foreground pointer-events-auto relative z-20 inline-flex min-w-0 items-center gap-1 underline-offset-4 transition hover:underline'
                >
                  {renderProjectTypeIcon(task.project.type, 'size-3 shrink-0')}
                  <span className='truncate'>{clientLabel}</span>
                </Link>
              ) : (
                <span className='inline-flex min-w-0 items-center gap-1'>
                  {renderProjectTypeIcon(task.project.type, 'size-3 shrink-0')}
                  <span className='truncate'>{clientLabel}</span>
                </span>
              )}
              <MetaSeparator />
              {projectLinkMeta.href ? (
                <Link
                  href={projectLinkMeta.href}
                  onClick={e => e.stopPropagation()}
                  className='hover:text-foreground pointer-events-auto relative z-20 inline-flex min-w-0 items-center gap-1 underline-offset-4 transition hover:underline'
                >
                  <FolderKanban className='size-3 shrink-0' aria-hidden />
                  <span className='truncate'>{task.project.name}</span>
                </Link>
              ) : (
                <span className='inline-flex min-w-0 items-center gap-1'>
                  <FolderKanban className='size-3 shrink-0' aria-hidden />
                  <span className='truncate'>{task.project.name}</span>
                </span>
              )}
              {/* No due date set is the common case -- say nothing rather than
                  spend a line saying there's nothing to say. */}
              {task.dueOn ? (
                <>
                  <MetaSeparator />
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1',
                      TASK_DUE_TONE_CLASSES[dueMeta.tone]
                    )}
                  >
                    <CalendarDays className='size-3 shrink-0' aria-hidden />
                    {dueMeta.label}
                  </span>
                </>
              ) : null}
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
        <p className='text-muted-foreground relative z-10 px-4 pt-1 pb-2.5 text-xs'>
          {linkMeta.reason}
        </p>
      ) : null}
    </li>
  )
}

function MetaSeparator() {
  return (
    <span aria-hidden className='shrink-0 opacity-50'>
      ·
    </span>
  )
}

function getTaskLinkMeta(task: AssignedTaskSummary): TaskLinkMeta {
  return {
    href: myTaskHref(task.id),
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
      href: `/projects/${PROJECT_SPECIAL_SEGMENTS.INTERNAL}/${projectSlug}/tasks`,
    }
  }

  if (project.type === 'PERSONAL') {
    return {
      href: `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${projectSlug}/tasks`,
    }
  }

  const clientSlug = client?.slug ?? null

  if (!clientSlug) {
    return { href: null }
  }

  return {
    href: `/projects/${clientSlug}/${projectSlug}/tasks`,
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
