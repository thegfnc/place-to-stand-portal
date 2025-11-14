import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { TransitionStartFunction } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { normalizeRawTask } from '@/lib/data/projects/normalize-task'
import type { RawTaskWithRelations } from '@/lib/data/projects/types'
import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import type { TaskLookup } from '../../state/types'

type ProjectsInput = Pick<
  ProjectWithRelations,
  'id' | 'tasks' | 'archivedTasks' | 'acceptedTasks'
>

type UseProjectsTaskRefreshArgs = {
  projects: ProjectsInput[]
  setTasksByProject: React.Dispatch<React.SetStateAction<TaskLookup>>
  setArchivedTasksByProject: React.Dispatch<React.SetStateAction<TaskLookup>>
  setAcceptedTasksByProject: React.Dispatch<React.SetStateAction<TaskLookup>>
  startTransition: TransitionStartFunction
}

type TaskRefreshState = {
  scheduleRefresh: (projectId: string) => void
}

export function useProjectsTaskRefresh({
  projects,
  setTasksByProject,
  setArchivedTasksByProject,
  setAcceptedTasksByProject,
  startTransition,
}: UseProjectsTaskRefreshArgs): TaskRefreshState {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const taskProjectLookupRef = useRef(new Map<string, string>())

  const registerProjectTasks = useCallback(
    (projectId: string, taskGroups: Array<TaskWithRelations[]>) => {
      const lookup = taskProjectLookupRef.current
      taskGroups.forEach(group => {
        group.forEach(task => {
          if (task?.id) {
            lookup.set(task.id, projectId)
          }
        })
      })
    },
    []
  )

  const resolveProjectIdForTask = useCallback(
    (taskId: string | null | undefined) => {
      if (!taskId) {
        return null
      }
      return taskProjectLookupRef.current.get(taskId) ?? null
    },
    []
  )

  const fetchProjectTasks = useCallback(async (projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const message = await extractErrorMessage(response)
      throw new Error(message ?? 'Failed to load project tasks.')
    }

    const data = (await response.json()) as {
      active: RawTaskWithRelations[]
      archived: RawTaskWithRelations[]
      accepted: RawTaskWithRelations[]
    } | null
    return (
      data ?? {
        active: [],
        archived: [],
        accepted: [],
      }
    )
  }, [])

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
        const collections = await fetchProjectTasks(projectId)
        const nextActive = collections.active.map(normalizeRawTask)
        const nextArchived = collections.archived.map(normalizeRawTask)
        const nextAccepted = collections.accepted.map(normalizeRawTask)
        registerProjectTasks(projectId, [
          nextActive,
          nextArchived,
          nextAccepted,
        ])

        startTransition(() => {
          setTasksByProject(prev =>
            updateTaskLookup(prev, projectId, nextActive)
          )
          setArchivedTasksByProject(prev =>
            updateTaskLookup(prev, projectId, nextArchived)
          )
          setAcceptedTasksByProject(prev =>
            updateTaskLookup(prev, projectId, nextAccepted)
          )
        })
      } catch (error) {
        console.error('Failed to refresh project tasks', { projectId, error })
      } finally {
        refreshInFlightRef.current.delete(projectId)
      }
    },
    [
      fetchProjectTasks,
      setArchivedTasksByProject,
      setAcceptedTasksByProject,
      setTasksByProject,
      startTransition,
      trackedProjectIdsSet,
      registerProjectTasks,
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
    const lookup = taskProjectLookupRef.current
    lookup.clear()
    projects.forEach(project => {
      if (!project?.id) {
        return
      }
      registerProjectTasks(project.id, [
        project.tasks ?? [],
        project.archivedTasks ?? [],
        project.acceptedTasks ?? [],
      ])
    })
  }, [projects, registerProjectTasks])

  useEffect(() => {
    if (!trackedProjectIds.length) {
      return
    }

    const filterValues = trackedProjectIds.map(id => '"' + id + '"').join(',')

    const handleTaskChange = (payload: {
      new: { project_id?: string } | null
      old: { project_id?: string } | null
    }) => {
      const projectId =
        payload.new?.project_id ?? payload.old?.project_id ?? null

      if (!projectId) {
        return
      }

      scheduleRefresh(projectId)
    }

    const handleAttachmentChange = (payload: {
      new: { task_id?: string } | null
      old: { task_id?: string } | null
    }) => {
      const taskId = payload.new?.task_id ?? payload.old?.task_id ?? null
      const projectId = resolveProjectIdForTask(taskId)
      if (!projectId) {
        return
      }
      scheduleRefresh(projectId)
    }

    const handleCommentChange = handleAttachmentChange

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
        handleTaskChange
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_attachments',
        },
        handleAttachmentChange
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_attachments',
        },
        handleAttachmentChange
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
        },
        handleCommentChange
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_comments',
        },
        handleCommentChange
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [
    projects,
    registerProjectTasks,
    resolveProjectIdForTask,
    scheduleRefresh,
    supabase,
    trackedProjectIds,
  ])

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

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = await response.json()

    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
    ) {
      return (payload as { error?: string }).error ?? null
    }
  } catch {
    // Ignore JSON parsing failures – only used for logging.
  }

  return null
}
