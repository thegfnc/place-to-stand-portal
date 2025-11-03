import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import type { TaskWithRelations } from '@/lib/types'

type FetchCalendarMonthTasksArgs = {
  projectId: string
  start: string
  end: string
}

export const calendarTasksQueryRoot = (projectId: string) =>
  ['projects', projectId, 'calendar'] as const

export const calendarTasksQueryKey = (
  projectId: string,
  start: string,
  end: string
) => [...calendarTasksQueryRoot(projectId), start, end] as const

export async function fetchCalendarMonthTasks({
  projectId,
  start,
  end,
}: FetchCalendarMonthTasksArgs): Promise<TaskWithRelations[]> {
  const params = new URLSearchParams({ start, end })
  const response = await fetch(
    `/api/v1/projects/${projectId}/calendar-tasks?${params.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const fallbackMessage = 'Unable to load calendar tasks.'

    try {
      const payload = (await response.json()) as { error?: string }
      throw new Error(payload.error ?? fallbackMessage)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(fallbackMessage)
    }
  }

  const payload = (await response.json()) as {
    tasks?: TaskWithRelations[]
    error?: string
  }

  if (payload.error) {
    throw new Error(payload.error)
  }

  return payload.tasks ?? []
}

type UseCalendarMonthTasksArgs = {
  projectId: string | null
  start: Date
  end: Date
  enabled?: boolean
}

export const useCalendarMonthTasks = ({
  projectId,
  start,
  end,
  enabled = true,
}: UseCalendarMonthTasksArgs) => {
  const startParam = useMemo(() => format(start, 'yyyy-MM-dd'), [start])
  const endParam = useMemo(() => format(end, 'yyyy-MM-dd'), [end])

  return useQuery<TaskWithRelations[]>({
    queryKey: projectId
      ? calendarTasksQueryKey(projectId, startParam, endParam)
      : ['projects', 'calendar', 'disabled', startParam, endParam],
    queryFn: () =>
      projectId
        ? fetchCalendarMonthTasks({
            projectId,
            start: startParam,
            end: endParam,
          })
        : Promise.resolve([]),
    enabled: Boolean(projectId) && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
