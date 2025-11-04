'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronRight, FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/auth/session'
import type { AssignedTaskSummary } from '@/lib/data/tasks'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'

type MyTasksWidgetProps = {
  tasks: AssignedTaskSummary[]
  role: UserRole
  userId: string
  className?: string
}

type TaskLinkMeta = {
  href: string | null
  reason?: string
}

const ACTIVE_STATUSES = new Set([
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
])

const STATUS_PRIORITY: Record<string, number> = {
  BLOCKED: 0,
  IN_PROGRESS: 1,
  IN_REVIEW: 2,
  ON_DECK: 3,
  BACKLOG: 4,
  DONE: 5,
  ARCHIVED: 6,
}

type RawTaskRow = {
  id: string
  title: string
  status: string
  due_on: string | null
  updated_at: string | null
  created_at: string | null
  deleted_at: string | null
  project_id: string
  project: {
    id: string
    name: string
    slug: string | null
    client?: {
      id: string
      name: string
      slug: string | null
    } | null
  } | null
  assignees: Array<{ user_id: string; deleted_at: string | null }> | null
}

export function MyTasksWidget({
  tasks,
  role,
  userId,
  className,
}: MyTasksWidgetProps) {
  const description =
    role === 'CLIENT'
      ? 'Tasks you are assigned to across your projects.'
      : 'Assigned work from every active project.'

  const [items, setItems] = useState<AssignedTaskSummary[]>(() =>
    sortTasks(tasks)
  )
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const refreshQueueRef = useRef(new Set<string>())
  const refreshTimerRef = useRef<number | null>(null)
  const refreshInFlightRef = useRef(new Set<string>())

  useEffect(() => {
    setItems(sortTasks(tasks))
  }, [tasks])

  const trackedTaskIds = useMemo(() => {
    const ids = items.map(task => task.id)
    ids.sort()
    return ids
  }, [items])

  const upsertTask = useCallback((nextTask: AssignedTaskSummary) => {
    setItems(prev => {
      const index = prev.findIndex(task => task.id === nextTask.id)
      const base =
        index === -1
          ? [...prev, nextTask]
          : prev.map(task => (task.id === nextTask.id ? nextTask : task))
      return sortTasks(base)
    })
  }, [])

  const removeTask = useCallback((taskId: string) => {
    setItems(prev => {
      const next = prev.filter(task => task.id !== taskId)
      if (next.length === prev.length) {
        return prev
      }
      return sortTasks(next)
    })
  }, [])

  const toTaskSummary = useCallback(
    (row: RawTaskRow | null): AssignedTaskSummary | null => {
      if (!row || row.deleted_at) {
        return null
      }

      const assignees = (row.assignees ?? []).filter(
        assignee => assignee && !assignee.deleted_at
      )

      if (!assignees.some(assignee => assignee.user_id === userId)) {
        return null
      }

      if (!ACTIVE_STATUSES.has(row.status ?? '')) {
        return null
      }

      const projectName = row.project?.name?.trim() || 'Untitled Project'

      const summary: AssignedTaskSummary = {
        id: row.id,
        title: row.title,
        status: row.status,
        dueOn: row.due_on ?? null,
        updatedAt: row.updated_at ?? row.created_at ?? null,
        project: {
          id: row.project?.id ?? row.project_id,
          name: projectName,
          slug: row.project?.slug ?? null,
        },
        client: row.project?.client
          ? {
              id: row.project.client.id,
              name: row.project.client.name,
              slug: row.project.client.slug ?? null,
            }
          : null,
      }

      return summary
    },
    [userId]
  )

  const loadTaskSummary = useCallback(
    async (taskId: string): Promise<AssignedTaskSummary | null> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          `
            id,
            title,
            status,
            due_on,
            updated_at,
            created_at,
            deleted_at,
            project_id,
            project:projects (
              id,
              name,
              slug,
              client:clients (
                id,
                name,
                slug
              )
            ),
            assignees:task_assignees (
              user_id,
              deleted_at
            )
          `
        )
        .eq('id', taskId)
        .maybeSingle()

      if (error) {
        console.error('Failed to load task summary', { taskId, error })
        return null
      }

      return toTaskSummary(data as RawTaskRow | null)
    },
    [supabase, toTaskSummary]
  )

  const refreshTask = useCallback(
    async (taskId: string) => {
      if (refreshInFlightRef.current.has(taskId)) {
        return
      }

      refreshInFlightRef.current.add(taskId)

      try {
        const summary = await loadTaskSummary(taskId)
        if (summary) {
          upsertTask(summary)
        } else {
          removeTask(taskId)
        }
      } finally {
        refreshInFlightRef.current.delete(taskId)
      }
    },
    [loadTaskSummary, removeTask, upsertTask]
  )

  const flushRefreshQueue = useCallback(() => {
    if (!refreshQueueRef.current.size) {
      return
    }

    const pending = Array.from(refreshQueueRef.current)
    refreshQueueRef.current.clear()
    refreshTimerRef.current = null

    pending.forEach(taskId => {
      void refreshTask(taskId)
    })
  }, [refreshTask])

  const scheduleRefresh = useCallback(
    (taskId: string | null) => {
      if (!taskId) {
        return
      }

      refreshQueueRef.current.add(taskId)

      if (refreshTimerRef.current !== null) {
        return
      }

      refreshTimerRef.current = window.setTimeout(() => {
        flushRefreshQueue()
      }, 75)
    },
    [flushRefreshQueue]
  )

  useEffect(() => {
    const queue = refreshQueueRef.current

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }

      queue.clear()
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`my-tasks-assignees:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignees',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const taskId =
            (payload.new as { task_id?: string } | null)?.task_id ?? null
          scheduleRefresh(taskId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_assignees',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const taskId =
            (payload.old as { task_id?: string } | null)?.task_id ?? null
          scheduleRefresh(taskId)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [scheduleRefresh, supabase, userId])

  useEffect(() => {
    if (!trackedTaskIds.length) {
      return
    }

    const filter = trackedTaskIds.map(id => '"' + id + '"').join(',')
    const channel = supabase
      .channel(`my-tasks-tasks:${filter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `id=in.(${filter})`,
        },
        payload => {
          const nextId =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id ??
            null

          scheduleRefresh(nextId)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [scheduleRefresh, supabase, trackedTaskIds])

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
          <h2 id='my-tasks-heading' className='text-base font-semibold'>
            My Tasks
          </h2>
          <p className='text-muted-foreground text-xs'>{description}</p>
        </div>
      </header>
      <div className='flex-1 overflow-hidden'>
        {items.length ? (
          <ul className='divide-border flex h-full flex-col divide-y'>
            {items.map(task => {
              const dueMeta = getTaskDueMeta(task.dueOn, {
                status: task.status,
              })
              const linkMeta = getLinkMeta(task)
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

function sortTasks(tasks: AssignedTaskSummary[]): AssignedTaskSummary[] {
  const copy = [...tasks]
  copy.sort(compareAssignedTasks)
  return copy
}

function compareAssignedTasks(a: AssignedTaskSummary, b: AssignedTaskSummary) {
  const dueA = getDueTimestamp(a.dueOn)
  const dueB = getDueTimestamp(b.dueOn)

  if (dueA !== null && dueB !== null && dueA !== dueB) {
    return dueA - dueB
  }

  if (dueA !== null && dueB === null) {
    return -1
  }

  if (dueA === null && dueB !== null) {
    return 1
  }

  const priorityA = STATUS_PRIORITY[a.status ?? ''] ?? Number.MAX_SAFE_INTEGER
  const priorityB = STATUS_PRIORITY[b.status ?? ''] ?? Number.MAX_SAFE_INTEGER

  if (priorityA !== priorityB) {
    return priorityA - priorityB
  }

  const updatedA = getTimestamp(a.updatedAt)
  const updatedB = getTimestamp(b.updatedAt)

  if (updatedA !== null && updatedB !== null && updatedA !== updatedB) {
    return updatedB - updatedA
  }

  if (updatedA !== null && updatedB === null) {
    return -1
  }

  if (updatedA === null && updatedB !== null) {
    return 1
  }

  return a.title.localeCompare(b.title)
}

function getDueTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function getTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}
