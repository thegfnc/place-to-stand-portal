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
  const [items, setItems] = useState(() => sortAssignedTasks(initialTasks))

  useEffect(() => {
    setItems(sortAssignedTasks(initialTasks))
  }, [initialTasks])

  return { items }
}
