'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { AssignedTaskSummary } from '@/lib/data/tasks'

import { sortAssignedTasks } from './assigned-task-utils'
import {
  type RawAssignedTaskRow,
  toAssignedTaskSummary,
} from './assigned-task-transform'

type UseMyTasksWidgetStateOptions = {
  initialTasks: AssignedTaskSummary[]
  userId: string
}

export function useMyTasksWidgetState({
  initialTasks,
  userId,
}: UseMyTasksWidgetStateOptions) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [items, setItems] = useState(() => sortAssignedTasks(initialTasks))
  const refreshQueueRef = useRef(new Set<string>())
  const refreshTimerRef = useRef<number | null>(null)
  const refreshInFlightRef = useRef(new Set<string>())

  useEffect(() => {
    setItems(sortAssignedTasks(initialTasks))
  }, [initialTasks])

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

      return sortAssignedTasks(base)
    })
  }, [])

  const removeTask = useCallback((taskId: string) => {
    setItems(prev => {
      const next = prev.filter(task => task.id !== taskId)
      if (next.length === prev.length) {
        return prev
      }

      return sortAssignedTasks(next)
    })
  }, [])

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

      return toAssignedTaskSummary(data as RawAssignedTaskRow | null, userId)
    },
    [supabase, userId]
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
    [loadTaskSummary, refreshInFlightRef, removeTask, upsertTask]
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
  }, [refreshQueueRef, refreshTask])

  const scheduleRefresh = useCallback(
    (taskId: string | null) => {
      if (!taskId) {
        return
      }

      refreshQueueRef.current.add(taskId)

      if (refreshTimerRef.current !== null) {
        return
      }

      // Batch refreshes to minimize Supabase traffic during bursts.
      refreshTimerRef.current = window.setTimeout(() => {
        flushRefreshQueue()
      }, 75)
    },
    [flushRefreshQueue, refreshQueueRef]
  )

  useEffect(() => {
    const queue = refreshQueueRef.current
    const inFlight = refreshInFlightRef.current

    return () => {
      inFlight.clear()

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

  return { items }
}
