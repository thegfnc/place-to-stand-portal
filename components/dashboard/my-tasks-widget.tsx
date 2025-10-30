'use client'

import Link from 'next/link'
import { CalendarDays, ChevronRight, FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/auth/session'
import type { AssignedTaskSummary } from '@/lib/data/tasks'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'

const STATUS_TOKENS: Record<string, string> = {
  BACKLOG:
    'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200',
  ON_DECK:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  IN_PROGRESS:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  BLOCKED:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  IN_REVIEW:
    'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  DONE: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  ARCHIVED:
    'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
}
const DEFAULT_STATUS_TOKEN = STATUS_TOKENS.BACKLOG

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  ON_DECK: 'On Deck',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  ARCHIVED: 'Archived',
}

type MyTasksWidgetProps = {
  tasks: AssignedTaskSummary[]
  role: UserRole
  className?: string
}

type TaskLinkMeta = {
  href: string | null
  reason?: string
}

export function MyTasksWidget({ tasks, role, className }: MyTasksWidgetProps) {
  const description =
    role === 'CLIENT'
      ? 'Tasks you are assigned to across your projects.'
      : 'Assigned work from every active project.'

  return (
    <section
      className={cn(
        'bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='my-tasks-heading'
    >
      <header className='flex items-start justify-between gap-3 border-b px-5 py-4'>
        <div>
          <h2 id='my-tasks-heading' className='text-lg font-semibold'>
            My Tasks
          </h2>
          <p className='text-muted-foreground text-sm'>{description}</p>
        </div>
      </header>
      <div className='flex-1 overflow-hidden'>
        {tasks.length ? (
          <ul className='divide-border flex h-full flex-col divide-y'>
            {tasks.map(task => {
              const dueMeta = getTaskDueMeta(task.dueOn)
              const linkMeta = getLinkMeta(task)

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
                          'border-transparent',
                          STATUS_TOKENS[task.status] ?? DEFAULT_STATUS_TOKEN
                        )}
                      >
                        {STATUS_LABELS[task.status] ?? task.status}
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
                <li key={task.id}>
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
            })}
          </ul>
        ) : (
          <EmptyState />
        )}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm'>
      <p>No tasks assigned to you yet.</p>
      <p className='max-w-xs text-xs'>
        Once teammates assign you to a task, it will appear here so you can jump
        straight into the right project.
      </p>
    </div>
  )
}
function getLinkMeta(task: AssignedTaskSummary): TaskLinkMeta {
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
