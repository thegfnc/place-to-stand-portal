'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ProjectTimeLogDialogParams } from './types'

type ProjectTask = ProjectTimeLogDialogParams['tasks'][number]

export type UseTimeLogTaskSelectionResult = {
  selectedTaskIds: string[]
  availableTasks: ProjectTimeLogDialogParams['tasks']
  selectedTasks: ProjectTimeLogDialogParams['tasks']
  isTaskPickerOpen: boolean
  onTaskPickerOpenChange: (open: boolean) => void
  onAddTask: (taskId: string) => void
  requestTaskRemoval: (task: ProjectTask) => void
  confirmTaskRemoval: () => void
  cancelTaskRemoval: () => void
  taskRemovalCandidate: ProjectTask | null
  initializeSelection: (taskIds?: string[]) => void
  resetSelection: () => void
}

export function useTimeLogTaskSelection(
  tasks: ProjectTimeLogDialogParams['tasks']
): UseTimeLogTaskSelectionResult {
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false)
  const [taskRemovalCandidate, setTaskRemovalCandidate] =
    useState<ProjectTask | null>(null)

  const eligibleTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.deleted_at !== null) {
        return false
      }
      if (task.status === 'ARCHIVED') {
        return false
      }
      if (task.accepted_at !== null) {
        return false
      }
      return true
    })
  }, [tasks])

  const availableTasks = useMemo(() => {
    if (selectedTaskIds.length === 0) {
      return eligibleTasks
    }

    const selectedSet = new Set(selectedTaskIds)
    return eligibleTasks.filter(task => !selectedSet.has(task.id))
  }, [eligibleTasks, selectedTaskIds])

  useEffect(() => {
    if (!isTaskPickerOpen || availableTasks.length !== 0) {
      return
    }

    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) {
        setIsTaskPickerOpen(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [availableTasks.length, isTaskPickerOpen])

  const selectedTasks = useMemo(() => {
    if (selectedTaskIds.length === 0) {
      return []
    }

    const taskLookup = new Map<string, ProjectTask>()
    eligibleTasks.forEach(task => {
      taskLookup.set(task.id, task)
    })

    return selectedTaskIds
      .map(taskId => taskLookup.get(taskId))
      .filter((task): task is ProjectTask => Boolean(task))
  }, [eligibleTasks, selectedTaskIds])

  const onAddTask = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev
      }
      return [...prev, taskId]
    })
  }, [])

  const requestTaskRemoval = useCallback((task: ProjectTask) => {
    setTaskRemovalCandidate(task)
  }, [])

  const confirmTaskRemoval = useCallback(() => {
    if (!taskRemovalCandidate) {
      return
    }

    setSelectedTaskIds(prev =>
      prev.filter(taskId => taskId !== taskRemovalCandidate.id)
    )
    setTaskRemovalCandidate(null)
  }, [taskRemovalCandidate])

  const cancelTaskRemoval = useCallback(() => {
    setTaskRemovalCandidate(null)
  }, [])

  const initializeSelection = useCallback((taskIds: string[] = []) => {
    setSelectedTaskIds(taskIds)
    setTaskRemovalCandidate(null)
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedTaskIds([])
    setTaskRemovalCandidate(null)
  }, [])

  return {
    selectedTaskIds,
    availableTasks,
    selectedTasks,
    isTaskPickerOpen,
    onTaskPickerOpenChange: setIsTaskPickerOpen,
    onAddTask,
    requestTaskRemoval,
    confirmTaskRemoval,
    cancelTaskRemoval,
    taskRemovalCandidate,
    initializeSelection,
    resetSelection,
  }
}
