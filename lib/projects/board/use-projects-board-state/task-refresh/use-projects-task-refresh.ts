import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { TransitionStartFunction } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { normalizeRawTask } from '@/lib/data/projects/normalize-task'
import type { RawTaskWithRelations } from '@/lib/data/projects/types'
import type { TaskWithRelations } from '@/lib/types'

import type { TaskLookup } from '../../state/types'

type UseProjectsTaskRefreshArgs = {
  projects: { id: string }[]
  setTasksByProject: React.Dispatch<React.SetStateAction<TaskLookup>>
  setArchivedTasksByProject: React.Dispatch<React.SetStateAction<TaskLookup>>
  startTransition: TransitionStartFunction
}

type TaskRefreshState = {
  scheduleRefresh: (projectId: string) => void
}

export function useProjectsTaskRefresh({
  projects,
  setTasksByProject,
  setArchivedTasksByProject,
  startTransition,
}: UseProjectsTaskRefreshArgs): TaskRefreshState {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const trackedProjectIds = useMemo(() => {
    const ids = projects.map(project => project.id).filter(Boolean)
    ids.sort()
    return ids
  }, [projects])

  const trackedProjectIdsSet = useMemo(
    () => new Set(trackedProjectIds),
    [trackedProjectIds]
  )

  const refreshQueueRef = useRef(new Set<string>())
  const refreshTimerRef = useRef<number | null>(null)
  const refreshInFlightRef = useRef(new Set<string>())

  const refreshProjectTasks = useCallback(
    async (projectId: string) => {
      if (!trackedProjectIdsSet.has(projectId)) {
        return
      }

      if (refreshInFlightRef.current.has(projectId)) {
        return
      }

      refreshInFlightRef.current.add(projectId)

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select(
            `
            id,
            project_id,
            title,
            description,
            status,
            rank,
            accepted_at,
            due_on,
            created_by,
            updated_by,
            created_at,
            updated_at,
            deleted_at,
            assignees:task_assignees (
              user_id,
              deleted_at
            ),
            comments:task_comments (
              id,
              deleted_at
            ),
            attachments:task_attachments (
              id,
              task_id,
              storage_path,
              original_name,
              mime_type,
              file_size,
              uploaded_by,
              created_at,
              updated_at,
              deleted_at
            )
          `
          )
          .eq('project_id', projectId)

        if (error) {
          console.error('Failed to refresh project tasks', { projectId, error })
          return
        }

        const rows = (data ?? []) as RawTaskWithRelations[]
        const normalizedTasks = rows.map(normalizeRawTask)
        const nextActive = normalizedTasks.filter(task => !task.deleted_at)
        const nextArchived = normalizedTasks.filter(task =>
          Boolean(task.deleted_at)
        )

        startTransition(() => {
          setTasksByProject(prev =>
            updateTaskLookup(prev, projectId, nextActive)
          )
          setArchivedTasksByProject(prev =>
            updateTaskLookup(prev, projectId, nextArchived)
          )
        })
      } finally {
        refreshInFlightRef.current.delete(projectId)
      }
    },
    [
      setArchivedTasksByProject,
      setTasksByProject,
      startTransition,
      supabase,
      trackedProjectIdsSet,
    ]
  )

  const flushQueuedRefreshes = useCallback(() => {
    if (!refreshQueueRef.current.size) {
      return
    }

    const pending = Array.from(refreshQueueRef.current)
    refreshQueueRef.current.clear()
    refreshTimerRef.current = null

    pending.forEach(projectId => {
      void refreshProjectTasks(projectId)
    })
  }, [refreshProjectTasks])

  const scheduleRefresh = useCallback(
    (projectId: string) => {
      if (!trackedProjectIdsSet.has(projectId)) {
        return
      }

      refreshQueueRef.current.add(projectId)

      if (refreshTimerRef.current !== null) {
        return
      }

      refreshTimerRef.current = window.setTimeout(() => {
        flushQueuedRefreshes()
      }, 75)
    },
    [flushQueuedRefreshes, trackedProjectIdsSet]
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
    if (!trackedProjectIds.length) {
      return
    }

    const filterValues = trackedProjectIds.map(id => '"' + id + '"').join(',')

    const channel = supabase
      .channel(`projects-board-tasks:${trackedProjectIds.join(',')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=in.(${filterValues})`,
        },
        payload => {
          const projectId =
            (payload.new as { project_id?: string } | null)?.project_id ??
            (payload.old as { project_id?: string } | null)?.project_id ??
            null

          if (!projectId) {
            return
          }

          scheduleRefresh(projectId)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [scheduleRefresh, supabase, trackedProjectIds])

  return { scheduleRefresh }
}

function updateTaskLookup(
  prev: TaskLookup,
  projectId: string,
  tasks: TaskWithRelations[]
): TaskLookup {
  const next = new Map(prev)
  next.set(projectId, tasks)
  return next
}
