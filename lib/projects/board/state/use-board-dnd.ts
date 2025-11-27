import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'

import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import { type BoardColumnId } from '../board-constants'
import {
  deriveReorderPlan,
  DropPreview,
  extractSortableMeta,
  prepareReorderOutcome,
  type DragComputeEvent,
  type ReorderOutcome,
  type ReorderPlan,
} from './dnd-helpers'
import type { TaskLookup } from './types'
import { useRecentlyMovedItem } from '@/lib/dnd/use-recently-moved-item'

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
  const [activeDropColumnId, setActiveDropColumnId] =
    useState<BoardColumnId | null>(null)
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null)
  const {
    recentlyMovedId: recentlyMovedTaskId,
    setRecentlyMovedId: setRecentlyMovedTaskId,
    scheduleReset: scheduleRecentlyMovedReset,
    clearTimer: clearRecentlyMovedTimer,
  } = useRecentlyMovedItem()

  const getReorderPlan = useCallback(
    (event: DragComputeEvent): ReorderPlan | null => {
      return deriveReorderPlan(event, tasksByProject)
    },
    [tasksByProject]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskId = String(event.active.id)
      setDragTaskId(taskId)
      setDropPreview(null)
      setRecentlyMovedTaskId(null)
      clearRecentlyMovedTimer()

      const activeSortable = extractSortableMeta(event.active.data.current)

      if (activeSortable) {
        setActiveDropColumnId(activeSortable.containerId as BoardColumnId)
      }
    },
    [clearRecentlyMovedTimer, setRecentlyMovedTaskId]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const plan = getReorderPlan(event)

      if (!plan) {
        setActiveDropColumnId(null)
        setDropPreview(null)
        return
      }

      setActiveDropColumnId(plan.destinationColumnId)

      const isSameColumn =
        plan.destinationColumnId === plan.sourceColumnId &&
        plan.targetIndex === plan.activeIndex

      if (isSameColumn) {
        setDropPreview(null)
        return
      }

      setDropPreview({
        columnId: plan.destinationColumnId,
        index: plan.targetIndex,
      })
    },
    [getReorderPlan]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const finishDrag = () => {
        setDropPreview(null)
        setDragTaskId(null)
        scheduleRecentlyMovedReset()
      }

      const deferFinishDrag = () => {
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(finishDrag)
        } else {
          finishDrag()
        }
      }

      setActiveDropColumnId(null)

      if (!canManageTasks || !activeProject) {
        finishDrag()
        return
      }

      const plan = getReorderPlan(event)

      if (!plan) {
        finishDrag()
        return
      }

      const { projectId, projectTasks, taskId } = plan

      let outcome: ReorderOutcome

      try {
        outcome = prepareReorderOutcome(plan)
      } catch (error) {
        console.error('Failed to compute rank for reordered task', error)
        setFeedback('Unable to reorder task.')
        finishDrag()
        return
      }

      if (outcome.status === 'noop') {
        finishDrag()
        return
      }

      const { destinationStatus, nextRank, recentlyMoved } = outcome

      if (recentlyMoved) {
        setRecentlyMovedTaskId(taskId)
      } else {
        setRecentlyMovedTaskId(null)
      }

      const rollbackTasks = projectTasks

      setFeedback(null)
      setTasksByProject(prev => {
        const next = new Map(prev)
        const tasks = next.get(projectId)

        if (!tasks) {
          return prev
        }

        const updated = tasks.map(task => {
          if (task.id !== taskId) {
            return task
          }

          return {
            ...task,
            status: destinationStatus,
            rank: nextRank,
          }
        })

        next.set(projectId, updated)
        return next
      })

      deferFinishDrag()

      const payload: { rank: string; status?: BoardColumnId } = {
        rank: nextRank,
      }

      if (recentlyMoved) {
        payload.status = destinationStatus
      }

      startTransition(async () => {
        try {
          const response = await fetch(`/api/v1/tasks/${taskId}/reorder`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`)
          }

          const json = await response.json().catch(() => null)
          const updatedRank = json?.task?.rank ?? nextRank
          const updatedStatus = json?.task?.status ?? destinationStatus
          const updatedAt = json?.task?.updated_at ?? null

          setTasksByProject(prev => {
            const next = new Map(prev)
            const tasks = next.get(projectId)

            if (!tasks) {
              return prev
            }

            const updated = tasks.map(task => {
              if (task.id !== taskId) {
                return task
              }

              return {
                ...task,
                status: updatedStatus,
                rank: updatedRank,
                updated_at: updatedAt ?? task.updated_at,
              }
            })

            next.set(projectId, updated)
            return next
          })
        } catch (error) {
          console.error('Task reorder failed', error)
          setFeedback('Unable to reorder task.')
          setTasksByProject(prev => {
            const next = new Map(prev)
            next.set(projectId, rollbackTasks)
            return next
          })
        }
      })
    },
    [
      activeProject,
      getReorderPlan,
      canManageTasks,
      setFeedback,
      setTasksByProject,
      scheduleRecentlyMovedReset,
      setRecentlyMovedTaskId,
      startTransition,
    ]
  )

  const draggingTask = useMemo(() => {
    if (!dragTaskId) return null
    return activeProjectTasks.find(task => task.id === dragTaskId) ?? null
  }, [activeProjectTasks, dragTaskId])

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    draggingTask,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
  }
}
