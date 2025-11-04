import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import { type BoardColumnId } from '../board-constants'
import { compareTasksByRank } from '../board-utils'
import { getRankBetween } from '@/lib/rank'
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

type TaskDragData = {
  type: 'task'
  taskId: string
  projectId: string
  columnId?: BoardColumnId
}

type ColumnDropData = {
  type: 'column'
  columnId: BoardColumnId
}

type SortableMeta = {
  containerId: string
  index: number
}

type DropPreview = {
  columnId: BoardColumnId
  index: number
}

const extractSortableMeta = (payload: unknown): SortableMeta | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const sortable = (payload as { sortable?: SortableMeta | null }).sortable
  if (!sortable) {
    return null
  }

  return {
    containerId: String(sortable.containerId),
    index: sortable.index,
  }
}

const getColumnTasks = (
  projectTasks: TaskWithRelations[],
  columnId: BoardColumnId
) =>
  projectTasks.filter(task => task.status === columnId).sort(compareTasksByRank)

const resolveDestinationColumnId = (
  over: DragEndEvent['over'],
  fallback: BoardColumnId
): BoardColumnId | null => {
  if (!over) {
    return null
  }

  const overData = over.data?.current as
    | TaskDragData
    | ColumnDropData
    | undefined

  const sortable = extractSortableMeta(over.data?.current)

  if (overData?.type === 'task') {
    if (sortable) {
      return sortable.containerId as BoardColumnId
    }

    if (overData.columnId) {
      return overData.columnId
    }

    return fallback
  }

  if (overData?.type === 'column') {
    return overData.columnId
  }

  if (typeof over.id === 'string') {
    return over.id as BoardColumnId
  }

  return null
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

  type DragComputeEvent = DragOverEvent | DragEndEvent

  type ReorderPlan = {
    projectId: string
    taskId: string
    projectTasks: TaskWithRelations[]
    currentTask: TaskWithRelations
    sourceColumnId: BoardColumnId
    destinationColumnId: BoardColumnId
    destinationTasks: TaskWithRelations[]
    activeIndex: number
    targetIndex: number
  }

  const buildReorderPlan = useCallback(
    (event: DragComputeEvent): ReorderPlan | null => {
      const activeData = event.active.data.current as TaskDragData | undefined

      if (!activeData || activeData.type !== 'task') {
        return null
      }

      const activeSortable = extractSortableMeta(event.active.data.current)

      if (!activeSortable) {
        return null
      }

      const projectId = activeData.projectId
      const taskId = activeData.taskId
      const projectTasks = tasksByProject.get(projectId)

      if (!projectTasks) {
        return null
      }

      const currentTask = projectTasks.find(task => task.id === taskId) ?? null

      if (!currentTask) {
        return null
      }

      const sourceColumnId = activeSortable.containerId as BoardColumnId
      const destinationColumnId = resolveDestinationColumnId(
        event.over,
        sourceColumnId
      )

      if (!destinationColumnId) {
        return null
      }

      const destinationTasks =
        sourceColumnId === destinationColumnId
          ? getColumnTasks(projectTasks, sourceColumnId)
          : getColumnTasks(projectTasks, destinationColumnId)

      const overSortable = extractSortableMeta(event.over?.data?.current)

      let targetIndex = overSortable
        ? overSortable.index
        : destinationTasks.length

      if (sourceColumnId === destinationColumnId) {
        if (destinationTasks.length === 0) {
          targetIndex = 0
        } else {
          targetIndex = Math.max(
            0,
            Math.min(targetIndex, destinationTasks.length - 1)
          )
        }
      } else {
        targetIndex = Math.max(
          0,
          Math.min(targetIndex, destinationTasks.length)
        )
      }

      return {
        projectId,
        taskId,
        projectTasks,
        currentTask,
        sourceColumnId,
        destinationColumnId,
        destinationTasks,
        activeIndex: activeSortable.index,
        targetIndex,
      }
    },
    [tasksByProject]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = String(event.active.id)
    setDragTaskId(taskId)
    setDropPreview(null)

    const activeSortable = extractSortableMeta(event.active.data.current)

    if (activeSortable) {
      setActiveDropColumnId(activeSortable.containerId as BoardColumnId)
    }
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const plan = buildReorderPlan(event)

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
    [buildReorderPlan]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const finishDrag = () => {
        setDropPreview(null)
        setDragTaskId(null)
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

      const plan = buildReorderPlan(event)

      if (!plan) {
        finishDrag()
        return
      }

      const {
        projectId,
        projectTasks,
        currentTask,
        destinationColumnId,
        sourceColumnId,
        destinationTasks,
        targetIndex,
        activeIndex,
        taskId,
      } = plan

      if (sourceColumnId === destinationColumnId) {
        if (destinationTasks.length === 0 || targetIndex === activeIndex) {
          finishDrag()
          return
        }
      }

      let orderedTasks: TaskWithRelations[]

      if (sourceColumnId === destinationColumnId) {
        orderedTasks = arrayMove(destinationTasks, activeIndex, targetIndex)
      } else {
        orderedTasks = [
          ...destinationTasks.slice(0, targetIndex),
          currentTask,
          ...destinationTasks.slice(targetIndex),
        ]
      }

      const nextIndex = orderedTasks.findIndex(task => task.id === taskId)

      if (nextIndex === -1) {
        finishDrag()
        return
      }

      const previousNeighbor = orderedTasks[nextIndex - 1] ?? null
      const nextNeighbor = orderedTasks[nextIndex + 1] ?? null

      let nextRank: string

      try {
        nextRank = getRankBetween(
          previousNeighbor ? previousNeighbor.rank : null,
          nextNeighbor ? nextNeighbor.rank : null
        )
      } catch (error) {
        console.error('Failed to compute rank for reordered task', error)
        setFeedback('Unable to reorder task.')
        finishDrag()
        return
      }

      const destinationStatus = destinationColumnId

      if (
        destinationStatus === currentTask.status &&
        nextRank === currentTask.rank
      ) {
        finishDrag()
        return
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

      if (destinationStatus !== currentTask.status) {
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
      buildReorderPlan,
      canManageTasks,
      setFeedback,
      setTasksByProject,
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
  }
}
