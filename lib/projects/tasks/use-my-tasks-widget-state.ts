'use client'

import { useEffect, useState } from 'react'

import type { AssignedTaskSummary } from '@/lib/data/tasks'

import { sortAssignedTasks } from './assigned-task-utils'

type UseMyTasksWidgetStateOptions = {
  initialTasks: AssignedTaskSummary[]
}

export function useMyTasksWidgetState({
  initialTasks,
}: UseMyTasksWidgetStateOptions) {
  const [items, setItems] = useState(() => buildVisibleTasks(initialTasks))

  useEffect(() => {
    setItems(buildVisibleTasks(initialTasks))
  }, [initialTasks])

  return { items }
}

function buildVisibleTasks(tasks: AssignedTaskSummary[]) {
  const filtered = tasks.filter(task => task.status !== 'DONE')
  return sortAssignedTasks(filtered)
}
