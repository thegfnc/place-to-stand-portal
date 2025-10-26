import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import { changeTaskStatus } from '@/app/(dashboard)/projects/actions'
import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import { type BoardColumnId } from '../board-constants'
import type { TaskLookup } from './types'

type UseBoardDnDArgs = {
  canManageTasks: boolean
  activeProject: ProjectWithRelations | null
  tasksByProject: TaskLookup
  setTasksByProject: Dispatch<SetStateAction<TaskLookup>>
  activeProjectTasks: TaskWithRelations[]
  startTransition: TransitionStartFunction
  setFeedback: Dispatch<SetStateAction<string | null>>
}

export const useBoardDnDState = ({
  canManageTasks,
  activeProject,
  tasksByProject,
  setTasksByProject,
  activeProjectTasks,
  startTransition,
  setFeedback,
}: UseBoardDnDArgs) => {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = String(event.active.id)
    setDragTaskId(taskId)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragTaskId(null)

      if (!canManageTasks || !activeProject) {
        return
      }

      const { active, over } = event

      if (!over) {
        return
      }

      const destinationStatus = over.id as BoardColumnId
      const activeData = active.data.current as
        | { type: string; taskId: string; projectId: string }
        | undefined

      if (!activeData || activeData.type !== 'task') {
        return
      }

      const { taskId, projectId } = activeData
      const projectTasks = tasksByProject.get(projectId)
      const task = projectTasks?.find(item => item.id === taskId)

      if (!task || task.status === destinationStatus) {
        return
      }

      const previousStatus = task.status as BoardColumnId

      setFeedback(null)
      setTasksByProject(prev => {
        const currentProjectTasks = prev.get(projectId)
        if (!currentProjectTasks) {
          return prev
        }

        const updatedProjectTasks = currentProjectTasks.map(item =>
          item.id === taskId ? { ...item, status: destinationStatus } : item
        )

        const next = new Map(prev)
        next.set(projectId, updatedProjectTasks)
        return next
      })

      startTransition(async () => {
        const result = await changeTaskStatus({
          taskId,
          status: destinationStatus,
        })

        if (result.error) {
          setFeedback(result.error)
          setTasksByProject(prev => {
            const currentProjectTasks = prev.get(projectId)
            if (!currentProjectTasks) {
              return prev
            }

            const revertedProjectTasks = currentProjectTasks.map(item =>
              item.id === taskId ? { ...item, status: previousStatus } : item
            )

            const next = new Map(prev)
            next.set(projectId, revertedProjectTasks)
            return next
          })
        }
      })
    },
    [
      activeProject,
      canManageTasks,
      setFeedback,
      setTasksByProject,
      startTransition,
      tasksByProject,
    ]
  )

  const draggingTask = useMemo(() => {
    if (!dragTaskId) return null
    return activeProjectTasks.find(task => task.id === dragTaskId) ?? null
  }, [activeProjectTasks, dragTaskId])

  return { handleDragStart, handleDragEnd, draggingTask }
}
