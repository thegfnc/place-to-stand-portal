import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { calendarTasksQueryRoot } from '@/lib/projects/calendar/use-calendar-month-tasks'
import type { TaskWithRelations } from '@/lib/types'

export type UseProjectCalendarSyncArgs = {
  activeProjectId: string | null
  tasks: TaskWithRelations[]
}

export function useProjectCalendarSync({
  activeProjectId,
  tasks,
}: UseProjectCalendarSyncArgs) {
  const queryClient = useQueryClient()

  const calendarTaskSignature = useMemo(() => {
    if (!activeProjectId) {
      return null
    }

    const relevantTasks = tasks
      .filter(
        task => task.due_on && !(task.status === 'DONE' && task.accepted_at)
      )
      .map(task =>
        [
          task.id,
          task.due_on ?? '',
          task.updated_at ?? '',
          task.status ?? '',
          task.accepted_at ?? '',
        ].join(':')
      )

    if (!relevantTasks.length) {
      return '__empty__'
    }

    relevantTasks.sort()
    return relevantTasks.join('|')
  }, [activeProjectId, tasks])

  const previousCalendarSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeProjectId) {
      previousCalendarSignatureRef.current = null
      return
    }

    if (calendarTaskSignature === null) {
      return
    }

    if (previousCalendarSignatureRef.current === calendarTaskSignature) {
      return
    }

    previousCalendarSignatureRef.current = calendarTaskSignature
    queryClient.invalidateQueries({
      queryKey: calendarTasksQueryRoot(activeProjectId),
    })
  }, [activeProjectId, calendarTaskSignature, queryClient])
}
