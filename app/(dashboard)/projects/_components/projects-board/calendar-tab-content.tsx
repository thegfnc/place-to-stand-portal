'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DndContext, type DndContextProps } from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { addMonths, format, startOfDay, startOfMonth } from 'date-fns'

import { TabsContent } from '@/components/ui/tabs'
import type { TaskWithRelations } from '@/lib/types'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import { TaskDragOverlay } from '../task-drag-overlay'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import {
  calendarTasksQueryKey,
  calendarTasksQueryRoot,
  fetchCalendarMonthTasks,
  useCalendarMonthTasks,
} from '@/lib/projects/calendar/use-calendar-month-tasks'
import type { RenderAssigneeFn } from '@/lib/projects/board/board-selectors'
import {
  buildCalendarDays,
  buildWeekdayHeaders,
  getCalendarRange,
} from '@/lib/projects/calendar/calendar-helpers'
import { useCalendarNavigation } from '@/lib/projects/calendar/use-calendar-navigation'
import { CalendarHeader } from './calendar/calendar-header'
import { CalendarGrid } from './calendar/calendar-grid'

type CalendarTabContentProps = {
  isActive: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  projectId: string | null
  assignedUserId: string | null
  onlyAssignedToMe: boolean
  renderAssignees: RenderAssigneeFn
  canManageTasks: boolean
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: (dueOn: string) => void
  sensors: DndContextProps['sensors']
  onDragStart: DndContextProps['onDragStart']
  onDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  scrimLocked: boolean
  isPending: boolean
  activeSheetTaskId: string | null
}

const TODAY_SCROLL_PADDING = 16
const EMPTY_TASKS: TaskWithRelations[] = []

export function CalendarTabContent({
  isActive,
  feedback,
  activeProject,
  projectId,
  assignedUserId,
  onlyAssignedToMe,
  renderAssignees,
  canManageTasks,
  onEditTask,
  onCreateTask,
  sensors,
  onDragStart,
  onDragEnd,
  draggingTask,
  activeSheetTaskId,
}: CalendarTabContentProps) {
  const queryClient = useQueryClient()
  const today = useMemo(() => startOfDay(new Date()), [])
  const baseMonth = useMemo(() => startOfMonth(today), [today])

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

  useEffect(() => {
    goToMonth(baseMonth)
  }, [activeProject?.id, baseMonth, goToMonth])

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getCalendarRange(currentMonth),
    [currentMonth]
  )

  const rangeStartIso = useMemo(
    () => format(rangeStart, 'yyyy-MM-dd'),
    [rangeStart]
  )
  const rangeEndIso = useMemo(() => format(rangeEnd, 'yyyy-MM-dd'), [rangeEnd])
  const todayKey = useMemo(() => format(today, 'yyyy-MM-dd'), [today])

  const calendarQuery = useCalendarMonthTasks({
    projectId,
    start: rangeStart,
    end: rangeEnd,
    enabled: isActive && Boolean(projectId),
  })

  const tasks = calendarQuery.data ?? EMPTY_TASKS

  const filteredTasks = useMemo(() => {
    if (!onlyAssignedToMe || !assignedUserId) {
      return tasks
    }

    return tasks.filter(task =>
      task.assignees.some(assignee => assignee.user_id === assignedUserId)
    )
  }, [assignedUserId, onlyAssignedToMe, tasks])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>()

    filteredTasks.forEach(task => {
      if (!task.due_on) {
        return
      }
      const bucket = map.get(task.due_on) ?? []
      bucket.push(task)
      map.set(task.due_on, bucket)
    })

    return map
  }, [filteredTasks])

  const days = useMemo(
    () => buildCalendarDays(rangeStart, rangeEnd, currentMonth, todayKey),
    [currentMonth, rangeEnd, rangeStart, todayKey]
  )

  const weekdayHeaders = useMemo(
    () => buildWeekdayHeaders(rangeStart),
    [rangeStart]
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const todayCellRef = useRef<HTMLDivElement | null>(null)

  const scrollTodayIntoView = useCallback(() => {
    const scrollElement = containerRef.current
    const targetElement = todayCellRef.current

    if (!scrollElement || !targetElement) {
      return
    }

    const headerHeight = headerRef.current
      ? headerRef.current.getBoundingClientRect().height
      : 0

    const containerRect = scrollElement.getBoundingClientRect()
    const elementRect = targetElement.getBoundingClientRect()
    const rawOffset =
      scrollElement.scrollTop + (elementRect.top - containerRect.top)
    const targetScrollTop = Math.max(
      0,
      rawOffset - headerHeight - TODAY_SCROLL_PADDING
    )

    scrollElement.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    })
  }, [])

  const prefetchMonth = useCallback(
    (month: Date) => {
      if (!projectId) {
        return
      }

      const normalized = startOfMonth(month)
      const { start, end } = getCalendarRange(normalized)
      const startParam = format(start, 'yyyy-MM-dd')
      const endParam = format(end, 'yyyy-MM-dd')

      queryClient.prefetchQuery({
        queryKey: calendarTasksQueryKey(projectId, startParam, endParam),
        queryFn: () =>
          fetchCalendarMonthTasks({
            projectId,
            start: startParam,
            end: endParam,
          }),
      })
    },
    [projectId, queryClient]
  )

  useEffect(() => {
    prefetchMonth(addMonths(currentMonth, -1))
    prefetchMonth(addMonths(currentMonth, 1))
  }, [currentMonth, prefetchMonth])

  const handleGoToToday = useCallback(() => {
    goToMonth(baseMonth)
    requestAnimationFrame(() => {
      scrollTodayIntoView()
    })
  }, [baseMonth, goToMonth, scrollTodayIntoView])

  const disabledReason = canManageTasks
    ? null
    : 'You need manage permissions to add tasks.'

  const handleInternalDragEnd = useCallback<
    NonNullable<DndContextProps['onDragEnd']>
  >(
    event => {
      onDragEnd?.(event)

      if (!projectId) {
        return
      }

      const overId = typeof event.over?.id === 'string' ? event.over.id : null
      if (!overId) {
        return
      }

      const taskId = String(event.active.id)
      queryClient.setQueryData<TaskWithRelations[] | undefined>(
        calendarTasksQueryKey(projectId, rangeStartIso, rangeEndIso),
        previous => {
          if (!previous) {
            return previous
          }

          const next = previous.map(task =>
            task.id === taskId ? { ...task, due_on: overId } : task
          )

          return next.filter(task => {
            const dueOn = task.due_on
            if (!dueOn) {
              return false
            }
            return dueOn >= rangeStartIso && dueOn <= rangeEndIso
          })
        }
      )

      queryClient.invalidateQueries({
        queryKey: calendarTasksQueryRoot(projectId),
      })
    },
    [onDragEnd, projectId, queryClient, rangeEndIso, rangeStartIso]
  )

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='calendar'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={handleInternalDragEnd}
        >
          <div className='relative min-h-0 flex-1'>
            <div
              ref={containerRef}
              className='bg-card absolute inset-0 overflow-y-auto rounded-xl border'
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
                  onGoToToday={handleGoToToday}
                />
                <div className='bg-card relative flex min-h-0 flex-1 overflow-hidden'>
                  <CalendarGrid
                    days={days}
                    weekdayHeaders={weekdayHeaders}
                    tasksByDate={tasksByDate}
                    canManageTasks={canManageTasks}
                    onCreateTask={onCreateTask}
                    disabledReason={disabledReason}
                    onEditTask={onEditTask}
                    renderAssignees={renderAssignees}
                    activeTaskId={activeSheetTaskId}
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
      )}
    </TabsContent>
  )
}
