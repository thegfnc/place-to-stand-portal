'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

import { KanbanColumn } from '@/app/(dashboard)/projects/_components/kanban-column'
import { TaskDragOverlay } from '@/app/(dashboard)/projects/_components/task-drag-overlay'
import { useProjectsBoardSensors } from '@/app/(dashboard)/projects/_hooks/use-projects-board-sensors'
import { useScrollPersistence } from '@/hooks/use-scroll-persistence'
import { useColumnScrollPersistence } from '@/hooks/use-column-scroll-persistence'
import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '@/lib/projects/board/board-selectors'
import {
  MY_TASK_BOARD_COLUMNS,
  type MyTaskStatus,
} from '@/lib/projects/tasks/my-tasks-constants'
import type { MyTasksReorderPayload } from '@/lib/projects/tasks/use-my-tasks-data'
import type { MyTasksInitialEntry } from './my-tasks-page'
import type { TaskContextDetails } from '@/app/(dashboard)/projects/task-card'

type TaskCardOptions = {
  context?: TaskContextDetails
  hideAssignees?: boolean
}

export type TaskLookupEntry = {
  task: TaskWithRelations
  project: ProjectWithRelations
}

export type TaskLookup = Map<string, TaskLookupEntry>

type MyTasksBoardProps = {
  entries: MyTasksInitialEntry[]
  taskLookup: TaskLookup
  renderAssignees: RenderAssigneeFn
  getTaskCardOptions?: (task: TaskWithRelations) => TaskCardOptions | undefined
  onOpenTask: (taskId: string) => void
  onReorder: (update: MyTasksBoardReorderUpdate) => void
  activeTaskId: string | null
  scrollStorageKey?: string | null
  onCreateTask?: (status: MyTaskStatus) => void
  canCreateTasks?: boolean
}

type TaskRow = {
  entry: MyTasksInitialEntry
  task: TaskWithRelations
  project: ProjectWithRelations
}

type TaskRowsByColumn = Map<MyTaskStatus, TaskRow[]>

export type MyTasksBoardReorderUpdate = {
  nextEntries: MyTasksInitialEntry[]
  previousEntries: MyTasksInitialEntry[]
  payload: MyTasksReorderPayload
}

export function MyTasksBoard({
  entries,
  taskLookup,
  renderAssignees,
  getTaskCardOptions,
  onOpenTask,
  onReorder,
  activeTaskId,
  scrollStorageKey,
  onCreateTask,
  canCreateTasks = false,
}: MyTasksBoardProps) {
  const { sensors } = useProjectsBoardSensors()
  const { viewportRef: boardViewportRef, handleScroll: handleBoardScroll } =
    useScrollPersistence({
      storageKey: scrollStorageKey ?? null,
      axis: 'x',
    })
  const { getColumnRef, getScrollHandler } = useColumnScrollPersistence({
    storageKey: scrollStorageKey ?? 'my-tasks-board',
    columnIds: MY_TASK_BOARD_COLUMNS.map(col => col.id),
  })
  const [draggingTask, setDraggingTask] = useState<TaskWithRelations | null>(
    null
  )
  const [dropPreview, setDropPreview] = useState<{
    columnId: MyTaskStatus
    index: number
  } | null>(null)
  const [recentlyMovedTaskId, setRecentlyMovedTaskId] = useState<string | null>(
    null
  )
  const boardCanManage = true

  const rowsByColumn = useMemo(
    () => buildRowsByColumn(entries, taskLookup),
    [entries, taskLookup]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskId = event.active.id?.toString()
      if (!taskId) {
        return
      }

      const lookup = taskLookup.get(taskId)

      if (!lookup) {
        return
      }

      setDraggingTask(lookup.task)
      setDropPreview(resolveCurrentLocation(taskId, rowsByColumn))
    },
    [rowsByColumn, taskLookup]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const preview = resolveDropTarget(event, rowsByColumn)
      setDropPreview(preview)
    },
    [rowsByColumn]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const taskId = event.active.id?.toString()
      const preview = dropPreview ?? resolveDropTarget(event, rowsByColumn)
      setDraggingTask(null)
      setDropPreview(null)

      if (!taskId || !preview) {
        return
      }

      const change = produceReorderUpdate({
        entries,
        taskLookup,
        taskId,
        targetStatus: preview.columnId,
        targetIndex: preview.index,
      })

      if (!change) {
        return
      }

      setRecentlyMovedTaskId(taskId)
      onReorder({
        nextEntries: change.nextEntries,
        previousEntries: entries,
        payload: change.payload,
      })
      setTimeout(() => setRecentlyMovedTaskId(null), 300)
    },
    [dropPreview, entries, onReorder, rowsByColumn, taskLookup]
  )

  const handleDragCancel = useCallback(() => {
    setDraggingTask(null)
    setDropPreview(null)
  }, [])

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='relative min-h-0 flex-1'>
        <div className='absolute inset-0 overflow-hidden'>
          <div
            ref={boardViewportRef}
            className='h-full min-h-0 overflow-x-auto'
            onScroll={handleBoardScroll}
          >
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className='flex h-full w-max gap-4 p-1'>
                {MY_TASK_BOARD_COLUMNS.map(column => {
                  const rows = rowsByColumn.get(column.id) ?? []
                  const handleCreateForColumn =
                    canCreateTasks && onCreateTask
                      ? () => onCreateTask(column.id)
                      : undefined

                  return (
                    <KanbanColumn
                      key={column.id}
                      columnId={column.id}
                      label={column.label}
                      tasks={rows.map(row => row.task)}
                      canManage={boardCanManage}
                      renderAssignees={renderAssignees}
                      onEditTask={task => onOpenTask(task.id)}
                      activeTaskId={activeTaskId}
                      onCreateTask={handleCreateForColumn}
                      enableCreateButton={canCreateTasks}
                      isDropTarget={dropPreview?.columnId === column.id}
                      dropIndicatorIndex={
                        dropPreview?.columnId === column.id
                          ? dropPreview.index
                          : null
                      }
                      draggingTask={draggingTask}
                      recentlyMovedTaskId={recentlyMovedTaskId}
                      getTaskCardOptions={getTaskCardOptions}
                      columnScrollRef={getColumnRef(column.id)}
                      onColumnScroll={getScrollHandler(column.id)}
                    />
                  )
                })}
              </div>
              <TaskDragOverlay
                draggingTask={draggingTask}
                renderAssignees={renderAssignees}
                getTaskCardOptions={getTaskCardOptions}
              />
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildRowsByColumn(
  entries: MyTasksInitialEntry[],
  lookup: TaskLookup
): TaskRowsByColumn {
  const rows: TaskRowsByColumn = new Map()

  MY_TASK_BOARD_COLUMNS.forEach(column => {
    rows.set(column.id, [])
  })

  entries.forEach(entry => {
    const meta = lookup.get(entry.taskId)
    if (!meta) {
      return
    }

    const status = normalizeStatus(meta.task.status)
    const bucket = rows.get(status)

    if (!bucket) {
      return
    }

    bucket.push({
      entry,
      task: meta.task,
      project: meta.project,
    })
  })

  rows.forEach(bucket => {
    bucket.sort((a, b) => compareRows(a, b))
  })

  return rows
}

function compareRows(a: TaskRow, b: TaskRow): number {
  const orderA = a.entry.sortOrder ?? null
  const orderB = b.entry.sortOrder ?? null

  if (orderA !== null && orderB !== null && orderA !== orderB) {
    return orderA - orderB
  }

  if (orderA !== null && orderB === null) {
    return -1
  }

  if (orderA === null && orderB !== null) {
    return 1
  }

  const dueA = getTimestamp(a.task.due_on)
  const dueB = getTimestamp(b.task.due_on)

  if (dueA !== null && dueB !== null && dueA !== dueB) {
    return dueA - dueB
  }

  if (dueA !== null) {
    return -1
  }

  if (dueB !== null) {
    return 1
  }

  const updatedA = getTimestamp(a.task.updated_at)
  const updatedB = getTimestamp(b.task.updated_at)

  if (updatedA !== null && updatedB !== null && updatedA !== updatedB) {
    return updatedB - updatedA
  }

  return a.task.title.localeCompare(b.task.title)
}

function resolveCurrentLocation(
  taskId: string,
  rowsByColumn: TaskRowsByColumn
) {
  for (const [status, rows] of rowsByColumn) {
    const index = rows.findIndex(row => row.task.id === taskId)
    if (index >= 0) {
      return { columnId: status, index }
    }
  }

  return null
}

function resolveDropTarget(
  event: DragOverEvent | DragEndEvent,
  rowsByColumn: TaskRowsByColumn
) {
  const overId = event.over?.id?.toString()

  if (!overId) {
    return null
  }

  const overData = event.over?.data.current as
    | { type: 'task'; columnId: MyTaskStatus }
    | { type: 'column'; columnId: MyTaskStatus }
    | undefined

  if (overData?.type === 'task') {
    const columnId = normalizeStatus(overData.columnId)
    const rows = rowsByColumn.get(columnId) ?? []
    const index = rows.findIndex(row => row.task.id === overId)
    return { columnId, index: index >= 0 ? index : rows.length }
  }

  if (overData?.type === 'column') {
    const columnId = normalizeStatus(overData.columnId)
    const rows = rowsByColumn.get(columnId) ?? []
    return { columnId, index: rows.length }
  }

  return null
}

function produceReorderUpdate({
  entries,
  taskLookup,
  taskId,
  targetStatus,
  targetIndex,
}: {
  entries: MyTasksInitialEntry[]
  taskLookup: TaskLookup
  taskId: string
  targetStatus: MyTaskStatus
  targetIndex: number
}): {
  nextEntries: MyTasksInitialEntry[]
  payload: MyTasksReorderPayload
} | null {
  const meta = taskLookup.get(taskId)

  if (!meta) {
    return null
  }

  const sourceStatus = normalizeStatus(meta.task.status)
  const columnBuckets = new Map<MyTaskStatus, MyTasksInitialEntry[]>(
    MY_TASK_BOARD_COLUMNS.map(column => [column.id, []])
  )

  entries.forEach(entry => {
    const lookup = taskLookup.get(entry.taskId)
    if (!lookup) {
      return
    }

    const status = normalizeStatus(lookup.task.status)
    const bucket = columnBuckets.get(status)
    if (bucket) {
      bucket.push({ ...entry })
    }
  })

  const sourceBucket = columnBuckets.get(sourceStatus)
  const targetBucket = columnBuckets.get(targetStatus)

  if (!sourceBucket || !targetBucket) {
    return null
  }

  const sourceIndex = sourceBucket.findIndex(entry => entry.taskId === taskId)

  if (sourceIndex === -1) {
    return null
  }

  const [movedEntry] = sourceBucket.splice(sourceIndex, 1)
  const boundedIndex = Math.min(Math.max(targetIndex, 0), targetBucket.length)
  targetBucket.splice(boundedIndex, 0, movedEntry)

  if (sourceStatus !== targetStatus) {
    meta.task.status = targetStatus
  }

  applySortOrdering(targetBucket)

  if (sourceStatus !== targetStatus) {
    applySortOrdering(sourceBucket)
  }

  const nextEntries = Array.from(columnBuckets.values()).flat()
  const payload: MyTasksReorderPayload = {
    taskId,
    targetStatus,
    targetOrder: targetBucket.map(entry => entry.taskId),
  }

  if (sourceStatus !== targetStatus) {
    payload.sourceStatus = sourceStatus
    payload.sourceOrder = sourceBucket.map(entry => entry.taskId)
  }

  return { nextEntries, payload }
}

function applySortOrdering(bucket: MyTasksInitialEntry[]) {
  bucket.forEach((entry, index) => {
    entry.sortOrder = index + 1
  })
}

function normalizeStatus(status: string | null | undefined): MyTaskStatus {
  switch (status) {
    case 'ON_DECK':
    case 'IN_PROGRESS':
    case 'BLOCKED':
    case 'IN_REVIEW':
    case 'DONE':
      return status
    default:
      return 'ON_DECK'
  }
}

function getTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}
