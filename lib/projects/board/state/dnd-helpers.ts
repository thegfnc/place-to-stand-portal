import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import type { TaskWithRelations } from '@/lib/types'

import { getRankBetween } from '@/lib/rank'
import type { BoardColumnId } from '../board-constants'
import { compareTasksByRank } from '../board-utils'
import type { TaskLookup } from './types'

export type TaskDragData = {
  type: 'task'
  taskId: string
  projectId: string
  columnId?: BoardColumnId
}

export type ColumnDropData = {
  type: 'column'
  columnId: BoardColumnId
}

export type SortableMeta = {
  containerId: string
  index: number
}

export type DropPreview = {
  columnId: BoardColumnId
  index: number
}

export type DragComputeEvent = DragOverEvent | DragEndEvent

export type ReorderPlan = {
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

export type ReorderOutcome =
  | { status: 'noop' }
  | {
      status: 'update'
      nextRank: string
      destinationStatus: BoardColumnId
      recentlyMoved: boolean
    }

export const extractSortableMeta = (payload: unknown): SortableMeta | null => {
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

export const getColumnTasks = (
  projectTasks: TaskWithRelations[],
  columnId: BoardColumnId
) =>
  projectTasks.filter(task => task.status === columnId).sort(compareTasksByRank)

export const resolveDestinationColumnId = (
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

export const deriveReorderPlan = (
  event: DragComputeEvent,
  tasksByProject: TaskLookup
): ReorderPlan | null => {
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

  let targetIndex = overSortable ? overSortable.index : destinationTasks.length

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
    targetIndex = Math.max(0, Math.min(targetIndex, destinationTasks.length))
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
}

export const prepareReorderOutcome = (plan: ReorderPlan): ReorderOutcome => {
  const {
    destinationTasks,
    sourceColumnId,
    destinationColumnId,
    activeIndex,
    targetIndex,
    currentTask,
    taskId,
  } = plan

  if (sourceColumnId === destinationColumnId) {
    if (destinationTasks.length === 0 || targetIndex === activeIndex) {
      return { status: 'noop' }
    }
  }

  const orderedTasks =
    sourceColumnId === destinationColumnId
      ? arrayMove(destinationTasks, activeIndex, targetIndex)
      : [
          ...destinationTasks.slice(0, targetIndex),
          currentTask,
          ...destinationTasks.slice(targetIndex),
        ]

  const nextIndex = orderedTasks.findIndex(task => task.id === taskId)

  if (nextIndex === -1) {
    return { status: 'noop' }
  }

  const previousNeighbor = orderedTasks[nextIndex - 1] ?? null
  const nextNeighbor = orderedTasks[nextIndex + 1] ?? null

  const nextRank = getRankBetween(
    previousNeighbor ? previousNeighbor.rank : null,
    nextNeighbor ? nextNeighbor.rank : null
  )

  const destinationStatus = destinationColumnId

  if (
    destinationStatus === currentTask.status &&
    nextRank === currentTask.rank
  ) {
    return { status: 'noop' }
  }

  return {
    status: 'update',
    nextRank,
    destinationStatus,
    recentlyMoved: destinationStatus !== currentTask.status,
  }
}
