'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { format, startOfDay, startOfMonth } from 'date-fns'
import { DndContext, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'

import { CalendarHeader } from '@/app/(dashboard)/projects/_components/projects-board/calendar/calendar-header'
import { CalendarGrid } from '@/app/(dashboard)/projects/_components/projects-board/calendar/calendar-grid'
import { TaskDragOverlay } from '@/app/(dashboard)/projects/_components/task-drag-overlay'
import { useProjectsBoardSensors } from '@/app/(dashboard)/projects/_hooks/use-projects-board-sensors'
import { useScrollPersistence } from '@/hooks/use-scroll-persistence'
import type { RenderAssigneeFn } from '@/lib/projects/board/board-selectors'
import { useCalendarNavigation } from '@/lib/projects/calendar/use-calendar-navigation'
import {
  buildCalendarDays,
  buildWeekdayHeaders,
  getCalendarRange,
} from '@/lib/projects/calendar/calendar-helpers'
import { useToast } from '@/components/ui/use-toast'
import type { TaskWithRelations } from '@/lib/types'

import type { MyTasksInitialEntry } from './my-tasks-page'
import type { TaskLookup } from './my-tasks-board'

type MyTasksCalendarProps = {
  entries: MyTasksInitialEntry[]
  taskLookup: TaskLookup
  renderAssignees: RenderAssigneeFn
  onOpenTask: (taskId: string) => void
  activeTaskId: string | null
  onDueDateChange: (taskId: string, dueOn: string | null) => void
  scrollStorageKey?: string | null
}

export function MyTasksCalendar({
  entries,
  taskLookup,
  renderAssignees,
  onOpenTask,
  activeTaskId,
  onDueDateChange,
  scrollStorageKey,
}: MyTasksCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const baseMonth = useMemo(() => startOfMonth(today), [today])
  const { sensors } = useProjectsBoardSensors()
  const { toast } = useToast()
  const [draggingTask, setDraggingTask] = useState<TaskWithRelations | null>(
    null
  )

  const {
    currentMonth,
    monthValue,
    yearValue,
    setYearValue,
    selectMonth,
    commitYearChange,
    goToPrevMonth,
    goToNextMonth,
    goToMonth,
  } = useCalendarNavigation({ baseMonth })

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getCalendarRange(currentMonth),
    [currentMonth]
  )
  const todayKey = useMemo(() => format(today, 'yyyy-MM-dd'), [today])
  const days = useMemo(
    () => buildCalendarDays(rangeStart, rangeEnd, currentMonth, todayKey),
    [currentMonth, rangeEnd, rangeStart, todayKey]
  )
  const weekdayHeaders = useMemo(
    () => buildWeekdayHeaders(rangeStart),
    [rangeStart]
  )
  const tasksByDate = useMemo(
    () => buildTasksByDate(entries, taskLookup),
    [entries, taskLookup]
  )

  const headerRef = useRef<HTMLDivElement | null>(null)
  const { viewportRef: containerRef, handleScroll: handleContainerScroll } =
    useScrollPersistence({
      storageKey: scrollStorageKey ?? null,
      axis: 'y',
    })
  const todayCellRef = useRef<HTMLDivElement | null>(null)

  const disabledReason = 'Use the project board to add tasks.'

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
    },
    [taskLookup]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const taskId = event.active.id?.toString()
      const overId = typeof event.over?.id === 'string' ? event.over.id : null

      setDraggingTask(null)

      if (!taskId || !overId) {
        return
      }

      const lookup = taskLookup.get(taskId)

      if (!lookup || lookup.task.due_on === overId) {
        return
      }

      const previousDueOn = lookup.task.due_on ?? null
      lookup.task.due_on = overId

      try {
        await updateMyTaskDueDate(taskId, overId)
        onDueDateChange(taskId, overId)
      } catch (error) {
        lookup.task.due_on = previousDueOn
        toast({
          variant: 'destructive',
          title: 'Unable to reschedule task',
          description:
            error instanceof Error ? error.message : 'Please try again.',
        })
      }
    },
    [onDueDateChange, taskLookup, toast]
  )

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className='relative min-h-0 flex-1'>
        <div
          ref={containerRef}
          className='bg-card absolute inset-0 overflow-y-auto rounded-xl border'
          onScroll={handleContainerScroll}
        >
          <div className='flex min-h-0 flex-1 flex-col'>
            <CalendarHeader
              headerRef={headerRef}
              currentMonth={currentMonth}
              monthValue={monthValue}
              yearValue={yearValue}
              onSelectMonth={selectMonth}
              onYearChange={setYearValue}
              onYearCommit={commitYearChange}
              onPrevMonth={goToPrevMonth}
              onNextMonth={goToNextMonth}
              onGoToToday={() => goToMonth(baseMonth)}
            />
            <div className='relative flex min-h-0 flex-1 overflow-hidden'>
              <CalendarGrid
                days={days}
                weekdayHeaders={weekdayHeaders}
                tasksByDate={tasksByDate}
                canManageTasks
                enableTaskCreation={false}
                onCreateTask={() => {}}
                disabledReason={disabledReason}
                onEditTask={task => onOpenTask(task.id)}
                renderAssignees={renderAssignees}
                activeTaskId={activeTaskId}
                todayCellRef={todayCellRef}
              />
            </div>
          </div>
        </div>
      </div>
      <TaskDragOverlay
        draggingTask={draggingTask}
        renderAssignees={renderAssignees}
        variant='calendar'
      />
    </DndContext>
  )
}

function buildTasksByDate(
  entries: MyTasksInitialEntry[],
  taskLookup: TaskLookup
) {
  const map = new Map<string, TaskWithRelations[]>()

  entries.forEach(entry => {
    const record = taskLookup.get(entry.taskId)

    if (!record?.task.due_on) {
      return
    }

    const bucket = map.get(record.task.due_on) ?? []
    bucket.push(record.task)
    map.set(record.task.due_on, bucket)
  })

  map.forEach(bucket => {
    bucket.sort((a, b) => {
      const updatedA = getTimestamp(a.updated_at)
      const updatedB = getTimestamp(b.updated_at)

      if (updatedA !== null && updatedB !== null && updatedA !== updatedB) {
        return updatedB - updatedA
      }

      return a.title.localeCompare(b.title)
    })
  })

  return map
}

async function updateMyTaskDueDate(taskId: string, dueOn: string) {
  const response = await fetch('/api/my-tasks/due-date', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, dueOn }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    throw new Error(payload?.error ?? 'Failed to update due date.')
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

