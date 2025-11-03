'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  DndContext,
  type DndContextProps,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameMonth,
  isWeekend,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'

import { TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { LoadingScrim } from './loading-scrim'
import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'
import { TaskDragOverlay } from '../task-drag-overlay'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import {
  calendarTasksQueryKey,
  calendarTasksQueryRoot,
  fetchCalendarMonthTasks,
  useCalendarMonthTasks,
} from '@/lib/projects/calendar/use-calendar-month-tasks'
import { CalendarTaskCardShell } from './calendar-task-card-shell'

const monthLabels = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2025, index, 1)
  return {
    value: String(index),
    label: format(date, 'MMMM'),
  }
})

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

type CalendarDay = {
  date: Date
  key: string
  label: string
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

const TODAY_SCROLL_PADDING = 16
const EMPTY_TASKS: TaskWithRelations[] = []

const getCalendarRange = (monthStart: Date) => {
  const start = startOfWeek(monthStart, { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 })
  return { start, end }
}

const buildCalendarDays = (
  rangeStart: Date,
  rangeEnd: Date,
  visibleMonth: Date,
  todayKey: string
): CalendarDay[] => {
  const days: CalendarDay[] = []

  eachDayOfInterval({ start: rangeStart, end: rangeEnd }).forEach(date => {
    const key = format(date, 'yyyy-MM-dd')
    days.push({
      date,
      key,
      label: format(date, 'd'),
      isCurrentMonth: isSameMonth(date, visibleMonth),
      isToday: key === todayKey,
      isWeekend: isWeekend(date),
    })
  })

  return days
}

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
  scrimLocked,
  isPending,
  activeSheetTaskId,
}: CalendarTabContentProps) {
  const queryClient = useQueryClient()
  const today = useMemo(() => startOfDay(new Date()), [])
  const baseMonth = useMemo(() => startOfMonth(today), [today])

  const [currentMonth, setCurrentMonth] = useState(baseMonth)
  const [monthValue, setMonthValue] = useState(() =>
    String(getMonth(baseMonth))
  )
  const [yearValue, setYearValue] = useState(() => String(getYear(baseMonth)))

  useEffect(() => {
    setMonthValue(String(getMonth(currentMonth)))
    setYearValue(String(getYear(currentMonth)))
  }, [currentMonth])

  useEffect(() => {
    setCurrentMonth(baseMonth)
  }, [activeProject?.id, baseMonth])

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
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(rangeStart, index)
        return {
          label: format(date, 'EEE'),
          isWeekend: isWeekend(date),
        }
      }),
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

  const handleSelectMonth = useCallback(
    (value: string) => {
      setMonthValue(value)
      const monthNumber = Number.parseInt(value, 10)

      if (Number.isNaN(monthNumber)) {
        return
      }

      const parsedYear = Number.parseInt(yearValue, 10)
      const yearNumber = Number.isNaN(parsedYear)
        ? getYear(currentMonth)
        : parsedYear

      const nextMonth = startOfMonth(new Date(yearNumber, monthNumber, 1))
      setCurrentMonth(nextMonth)
      prefetchMonth(nextMonth)
    },
    [currentMonth, prefetchMonth, yearValue]
  )

  const commitYearChange = useCallback(() => {
    const parsedYear = Number.parseInt(yearValue, 10)

    if (Number.isNaN(parsedYear)) {
      setYearValue(String(getYear(currentMonth)))
      return
    }

    const nextMonth = startOfMonth(
      new Date(parsedYear, getMonth(currentMonth), 1)
    )
    setCurrentMonth(nextMonth)
    prefetchMonth(nextMonth)
  }, [currentMonth, prefetchMonth, yearValue])

  const handlePrevMonth = useCallback(() => {
    const nextMonth = startOfMonth(addMonths(currentMonth, -1))
    setCurrentMonth(nextMonth)
    prefetchMonth(nextMonth)
  }, [currentMonth, prefetchMonth])

  const handleNextMonth = useCallback(() => {
    const nextMonth = startOfMonth(addMonths(currentMonth, 1))
    setCurrentMonth(nextMonth)
    prefetchMonth(nextMonth)
  }, [currentMonth, prefetchMonth])

  const handleGoToToday = useCallback(() => {
    setCurrentMonth(baseMonth)
    prefetchMonth(baseMonth)
    requestAnimationFrame(() => {
      scrollTodayIntoView()
    })
  }, [baseMonth, prefetchMonth, scrollTodayIntoView])

  const queryInFlight = calendarQuery.isPending || calendarQuery.isFetching
  const loadingVisible = !scrimLocked && (isPending || queryInFlight)
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
                <div
                  ref={headerRef}
                  className='bg-card sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-xl px-4 py-3 shadow-sm'
                >
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-lg font-semibold'>
                        {format(currentMonth, 'MMMM yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className='flex grow items-center justify-end gap-4'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={handleGoToToday}
                    >
                      Today
                    </Button>
                    <div className='flex items-center gap-2'>
                      <Select
                        value={monthValue}
                        onValueChange={handleSelectMonth}
                      >
                        <SelectTrigger className='w-32'>
                          <SelectValue aria-label='Select month' />
                        </SelectTrigger>
                        <SelectContent>
                          {monthLabels.map(month => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <form
                        onSubmit={event => {
                          event.preventDefault()
                          commitYearChange()
                        }}
                      >
                        <Input
                          value={yearValue}
                          onChange={event => setYearValue(event.target.value)}
                          onBlur={commitYearChange}
                          inputMode='numeric'
                          className='w-24'
                          aria-label='Select year'
                        />
                      </form>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        onClick={handlePrevMonth}
                        aria-label='View previous month'
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        onClick={handleNextMonth}
                        aria-label='View next month'
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className='bg-card relative flex min-h-0 flex-1 overflow-hidden'>
                  <div className='flex-1 px-4 py-6'>
                    <div className='grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide'>
                      {weekdayHeaders.map(({ label, isWeekend }) => (
                        <span
                          key={label}
                          className={cn(
                            'rounded-md px-2 py-1 text-muted-foreground',
                            isWeekend && 'bg-secondary/20 text-secondary-foreground'
                          )}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className='mt-2 grid grid-cols-7 gap-2'>
                      {days.map(day => (
                        <CalendarDayCell
                          key={day.key}
                          day={day}
                          canManageTasks={canManageTasks}
                          onCreateTask={onCreateTask}
                          disabledReason={disabledReason}
                          tasks={tasksByDate.get(day.key) ?? []}
                          onEditTask={onEditTask}
                          renderAssignees={renderAssignees}
                          activeTaskId={activeSheetTaskId}
                          todayCellRef={day.isToday ? todayCellRef : undefined}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <LoadingScrim visible={loadingVisible} />
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

type CalendarDayCellProps = {
  day: CalendarDay
  canManageTasks: boolean
  onCreateTask: (dueOn: string) => void
  disabledReason: string | null
  tasks: TaskWithRelations[]
  onEditTask: (task: TaskWithRelations) => void
  renderAssignees: RenderAssigneeFn
  todayCellRef?: RefObject<HTMLDivElement | null>
  activeTaskId: string | null
}

function CalendarDayCell({
  day,
  canManageTasks,
  onCreateTask,
  disabledReason,
  tasks,
  onEditTask,
  renderAssignees,
  todayCellRef,
  activeTaskId,
}: CalendarDayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: day.key,
    disabled: !canManageTasks,
  })

  const addButton = (
    <Button
      type='button'
      size='icon'
      variant='ghost'
      className='h-6 w-6'
      onClick={() => onCreateTask(day.key)}
      disabled={!canManageTasks}
    >
      <Plus className='h-4 w-4' />
      <span className='sr-only'>
        Add task for {format(day.date, 'MMMM d, yyyy')}
      </span>
    </Button>
  )

  return (
    <div
      ref={element => {
        setNodeRef(element)
        if (todayCellRef) {
          todayCellRef.current = element
        }
      }}
      className={cn(
        'flex h-full min-h-[140px] flex-col gap-2 rounded-lg border border-border bg-background p-2 text-xs transition-shadow',
        !day.isCurrentMonth &&
          'border-dashed border-muted-foreground/40 bg-muted/60 text-muted-foreground',
        day.isWeekend &&
          (day.isCurrentMonth ? 'bg-secondary/20' : 'bg-secondary/10'),
        day.isWeekend && 'ring-1 ring-secondary/30',
        day.isToday && 'border-primary bg-primary/10 shadow-sm',
        isOver && 'border-primary ring-primary/40 ring-2'
      )}
    >
      <div className='flex items-center justify-between'>
        <span
          className={cn(
            'text-sm font-semibold',
            day.isWeekend && day.isCurrentMonth && 'text-secondary-foreground',
            !day.isCurrentMonth && 'text-muted-foreground'
          )}
        >
          {day.label}
        </span>
        {canManageTasks ? (
          addButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{addButton}</TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className='flex flex-col gap-1 overflow-y-auto pr-1 pb-1'>
        {tasks.map(task => (
          <CalendarTaskCard
            key={task.id}
            task={task}
            canManageTasks={canManageTasks}
            onEditTask={onEditTask}
            renderAssignees={renderAssignees}
            isActive={task.id === activeTaskId}
          />
        ))}
      </div>
    </div>
  )
}

type CalendarTaskCardProps = {
  task: TaskWithRelations
  canManageTasks: boolean
  onEditTask: (task: TaskWithRelations) => void
  renderAssignees: RenderAssigneeFn
  isActive: boolean
}

function CalendarTaskCard({
  task,
  canManageTasks,
  onEditTask,
  renderAssignees,
  isActive,
}: CalendarTaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !canManageTasks,
    data: {
      type: 'task',
      taskId: task.id,
      projectId: task.project_id,
    },
  })

  const assignees = renderAssignees(task)
  const primaryAssignee = assignees[0]?.name ?? 'Unassigned'
  const sanitizedAttributes = useMemo(() => {
    if (!attributes) {
      return {}
    }

    const {
      role: _omitRole,
      tabIndex: _omitTabIndex,
      ['aria-describedby']: _omitDescribedBy,
      ...rest
    } = attributes
    void _omitRole
    void _omitTabIndex
    void _omitDescribedBy
    return rest
  }, [attributes])

  return (
    <CalendarTaskCardShell
      ref={setNodeRef}
      task={task}
      primaryAssignee={primaryAssignee}
      canManageTasks={canManageTasks}
      isActive={isActive}
      isDragging={isDragging}
      hideWhileDragging
      role='button'
      tabIndex={0}
      onClick={() => onEditTask(task)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEditTask(task)
        }
      }}
      {...sanitizedAttributes}
      {...listeners}
    />
  )
}
