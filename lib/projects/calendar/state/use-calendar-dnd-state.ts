import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import { changeTaskDueDate } from '@/app/(dashboard)/projects/actions'
import type { TaskWithRelations } from '@/lib/types'

import type { TaskLookup } from '../../board/state/types'

type UseCalendarDnDStateArgs = {
  canManageTasks: boolean
  tasksByProject: TaskLookup
  setTasksByProject: Dispatch<SetStateAction<TaskLookup>>
  startTransition: TransitionStartFunction
  setFeedback: Dispatch<SetStateAction<string | null>>
  activeProjectTasks: TaskWithRelations[]
}

type CalendarDragData = {
  type: 'task'
  taskId: string
  projectId: string
}

const isCalendarDragData = (value: unknown): value is CalendarDragData =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      (value as CalendarDragData).type === 'task' &&
      'taskId' in value &&
      typeof (value as CalendarDragData).taskId === 'string' &&
      'projectId' in value &&
      typeof (value as CalendarDragData).projectId === 'string'
  )

export const useCalendarDnDState = ({
  canManageTasks,
  tasksByProject,
  setTasksByProject,
  startTransition,
  setFeedback,
  activeProjectTasks,
}: UseCalendarDnDStateArgs) => {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragTaskId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragTaskId(null)

      if (!canManageTasks) {
        return
      }

      const { active, over } = event

      if (!over) {
        return
      }

      const dropTargetId = typeof over.id === 'string' ? over.id : null

      if (!dropTargetId) {
        return
      }

      const activeData = active.data.current

      if (!isCalendarDragData(activeData)) {
        return
      }

      const { taskId, projectId } = activeData
      const projectTasks = tasksByProject.get(projectId)
      const task = projectTasks?.find(item => item.id === taskId)

      if (!task) {
        return
      }

      const nextDueOn = dropTargetId
      const previousDueOn = task.due_on ?? null

      if (previousDueOn === nextDueOn) {
        return
      }

      setFeedback(null)
      setTasksByProject(prev => {
        const currentProjectTasks = prev.get(projectId)
        if (!currentProjectTasks) {
          return prev
        }

        const updatedProjectTasks = currentProjectTasks.map(item =>
          item.id === taskId ? { ...item, due_on: nextDueOn } : item
        )

        const next = new Map(prev)
        next.set(projectId, updatedProjectTasks)
        return next
      })

      startTransition(async () => {
        const result = await changeTaskDueDate({
          taskId,
          dueOn: nextDueOn,
        })

        if (result.error) {
          setFeedback(result.error)
          setTasksByProject(prev => {
            const currentProjectTasks = prev.get(projectId)
            if (!currentProjectTasks) {
              return prev
            }

            const revertedProjectTasks = currentProjectTasks.map(item =>
              item.id === taskId ? { ...item, due_on: previousDueOn } : item
            )

            const next = new Map(prev)
            next.set(projectId, revertedProjectTasks)
            return next
          })
        }
      })
    },
    [
      canManageTasks,
      setFeedback,
      setTasksByProject,
      startTransition,
      tasksByProject,
    ]
  )

  const draggingTask = useMemo(() => {
    if (!dragTaskId) {
      return null
    }

    return activeProjectTasks.find(task => task.id === dragTaskId) ?? null
  }, [activeProjectTasks, dragTaskId])

  return { handleDragStart, handleDragEnd, draggingTask }
}
