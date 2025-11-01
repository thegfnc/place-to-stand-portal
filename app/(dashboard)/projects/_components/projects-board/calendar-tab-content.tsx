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
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  format,
  getDay,
  getDaysInMonth,
  getMonth,
  getYear,
  isWeekend,
  parseISO,
  startOfDay,
  startOfMonth,
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
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'
import type { ProjectsBoardActiveProject } from './board-tab-content'

const BUFFER_MONTHS = 6
const MONTH_ESTIMATED_HEIGHT = 680
const YEARS_EITHER_SIDE = 2
const DEFAULT_PAST_MONTHS = YEARS_EITHER_SIDE * 12
const DEFAULT_FUTURE_MONTHS = YEARS_EITHER_SIDE * 12
const MONTH_RANGE_PADDING = 2
const MONTH_SCROLL_PADDING = 16

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
  tasks: TaskWithRelations[]
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
}

type CalendarDay = {
  date: Date
  key: string
  label: string
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

type CalendarMonth = {
  offset: number
  monthStart: Date
  label: string
  year: number
  daysInMonth: number
  firstWeekdayIndex: number
}

type MonthRange = {
  start: number
  end: number
}

type ScrollBehaviorOption = 'auto' | 'smooth'

type PendingScrollRequest = {
  offset: number
  behavior?: ScrollBehaviorOption
}
const deriveBaseRange = (
  baseMonth: Date,
  tasks: TaskWithRelations[]
): MonthRange => {
  let minOffset = -DEFAULT_PAST_MONTHS
  let maxOffset = DEFAULT_FUTURE_MONTHS

  tasks.forEach(task => {
    if (!task.due_on) {
      return
    }

    try {
      const taskMonthStart = startOfMonth(parseISO(task.due_on))
      const offset = differenceInCalendarMonths(taskMonthStart, baseMonth)
      minOffset = Math.min(minOffset, offset - MONTH_RANGE_PADDING)
      maxOffset = Math.max(maxOffset, offset + MONTH_RANGE_PADDING)
    } catch (error) {
      console.warn('Invalid task due date encountered in calendar range', {
        taskId: task.id,
        dueOn: task.due_on,
        error,
      })
    }
  })

  return { start: minOffset, end: maxOffset }
}

const buildCalendarMonth = (baseMonth: Date, offset: number): CalendarMonth => {
  const monthStart = addMonths(baseMonth, offset)
  const monthLabel = format(monthStart, 'MMMM')
  const year = getYear(monthStart)

  return {
    offset,
    monthStart,
    label: monthLabel,
    year,
    daysInMonth: getDaysInMonth(monthStart),
    firstWeekdayIndex: getDay(monthStart),
  }
}

const buildCalendarDays = (
  month: CalendarMonth,
  todayKey: string
): CalendarDay[] => {
  const { monthStart, daysInMonth } = month
  const days: CalendarDay[] = []

  for (let index = 0; index < daysInMonth; index += 1) {
    const date = addDays(monthStart, index)
    const key = format(date, 'yyyy-MM-dd')
    days.push({
      date,
      key,
      label: format(date, 'd'),
      isCurrentMonth: true,
      isToday: key === todayKey,
      isWeekend: isWeekend(date),
    })
  }

  return days
}

export function CalendarTabContent({
  isActive,
  feedback,
  activeProject,
  tasks,
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
}: CalendarTabContentProps) {
  const baseMonth = useMemo(() => startOfMonth(startOfDay(new Date())), [])
  const baseRange = useMemo(
    () => deriveBaseRange(baseMonth, tasks),
    [baseMonth, tasks]
  )
  const [monthRange, setMonthRange] = useState(baseRange)

  useEffect(() => {
    setMonthRange(prev => {
      const nextStart = Math.min(prev.start, baseRange.start)
      const nextEnd = Math.max(prev.end, baseRange.end)
      if (nextStart === prev.start && nextEnd === prev.end) {
        return prev
      }
      return { start: nextStart, end: nextEnd }
    })
  }, [baseRange.end, baseRange.start])
  const months = useMemo(() => {
    const list: CalendarMonth[] = []
    for (let offset = monthRange.start; offset <= monthRange.end; offset += 1) {
      list.push(buildCalendarMonth(baseMonth, offset))
    }
    return list
  }, [baseMonth, monthRange.end, monthRange.start])

  const todayKey = useMemo(
    () => format(startOfDay(new Date()), 'yyyy-MM-dd'),
    []
  )

  const initialMonthIndex = useMemo(
    () => months.findIndex(month => month.offset === 0),
    [months]
  )

  const [activeMonthOffset, setActiveMonthOffset] = useState(() => {
    if (initialMonthIndex !== -1) {
      return months[initialMonthIndex]?.offset ?? 0
    }
    return months[0]?.offset ?? 0
  })

  const activeMonthIndex = useMemo(() => {
    const index = months.findIndex(month => month.offset === activeMonthOffset)
    if (index !== -1) {
      return index
    }
    if (initialMonthIndex !== -1) {
      return initialMonthIndex
    }
    return 0
  }, [activeMonthOffset, initialMonthIndex, months])
  const [monthValue, setMonthValue] = useState(() =>
    String(getMonth(months[initialMonthIndex]?.monthStart ?? baseMonth))
  )
  const [yearValue, setYearValue] = useState(() =>
    String(getYear(months[initialMonthIndex]?.monthStart ?? baseMonth))
  )

  useEffect(() => {
    if (!months.length) {
      return
    }

    const offsetExists = months.some(
      month => month.offset === activeMonthOffset
    )

    if (offsetExists) {
      return
    }

    const fallbackIndex = initialMonthIndex === -1 ? 0 : initialMonthIndex
    const fallbackOffset = months[fallbackIndex]?.offset ?? months[0]?.offset
    if (typeof fallbackOffset === 'number') {
      setActiveMonthOffset(fallbackOffset)
    }
  }, [activeMonthOffset, initialMonthIndex, months])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const todayCellRef = useRef<HTMLDivElement | null>(null)
  const hasCenteredTodayRef = useRef(false)
  const resumeSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- Virtualizer intentionally manages dynamic DOM measurements outside React memoization.
  const monthVirtualizer = useVirtualizer({
    count: months.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => MONTH_ESTIMATED_HEIGHT,
    overscan: BUFFER_MONTHS,
    indexAttribute: 'data-index',
    getItemKey: index => {
      const month = months[index]
      if (!month) {
        return index
      }
      return `${month.year}-${getMonth(month.monthStart)}`
    },
  })

  const virtualMonths = monthVirtualizer.getVirtualItems()

  const measureMonthElement = useCallback(
    (element: HTMLDivElement | null) => {
      monthVirtualizer.measureElement(element)
    },
    [monthVirtualizer]
  )

  const [selectorSyncSuspended, setSelectorSyncSuspended] = useState(false)
  const [pendingScroll, setPendingScroll] =
    useState<PendingScrollRequest | null>(null)

  useEffect(() => {
    hasCenteredTodayRef.current = false
  }, [baseRange.end, baseRange.start])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>()
    tasks.forEach(task => {
      if (!task.due_on) {
        return
      }
      const bucket = map.get(task.due_on) ?? []
      bucket.push(task)
      map.set(task.due_on, bucket)
    })
    return map
  }, [tasks])

  useEffect(() => {
    if (hasCenteredTodayRef.current) {
      return
    }

    if (!months.length) {
      return
    }

    const scrollElement = containerRef.current
    if (!scrollElement) {
      return
    }

    hasCenteredTodayRef.current = true
    const targetIndex = initialMonthIndex === -1 ? 0 : initialMonthIndex
    monthVirtualizer.scrollToIndex(targetIndex, { align: 'start' })

    requestAnimationFrame(() => {
      todayCellRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    })
  }, [initialMonthIndex, monthVirtualizer, months.length])

  useEffect(() => {
    if (selectorSyncSuspended) {
      return
    }

    const currentMonth = months[activeMonthIndex]
    if (!currentMonth) {
      return
    }

    setMonthValue(String(getMonth(currentMonth.monthStart)))
    setYearValue(String(currentMonth.year))
  }, [activeMonthIndex, months, selectorSyncSuspended])

  useEffect(() => {
    const scrollElement = containerRef.current
    if (!scrollElement || virtualMonths.length === 0) {
      return
    }

    const midpoint = scrollElement.scrollTop + scrollElement.clientHeight / 2
    let targetIndex = virtualMonths[0].index
    for (const item of virtualMonths) {
      const itemStart = item.start
      const itemEnd = item.start + item.size
      if (midpoint >= itemStart && midpoint < itemEnd) {
        targetIndex = item.index
        break
      }

      if (midpoint >= itemEnd) {
        targetIndex = item.index
      }
    }

    if (targetIndex !== activeMonthIndex) {
      const targetMonth = months[targetIndex]
      if (targetMonth && targetMonth.offset !== activeMonthOffset) {
        setActiveMonthOffset(targetMonth.offset)
      }
    }
  }, [activeMonthIndex, activeMonthOffset, months, virtualMonths])

  useEffect(() => {
    const scrollElement = containerRef.current
    if (!scrollElement) {
      return
    }

    const handleScroll = () => {
      if (!selectorSyncSuspended) {
        return
      }

      if (resumeSyncTimeoutRef.current) {
        clearTimeout(resumeSyncTimeoutRef.current)
      }

      resumeSyncTimeoutRef.current = setTimeout(() => {
        setSelectorSyncSuspended(false)
      }, 200)
    }

    scrollElement.addEventListener('scroll', handleScroll)
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      if (resumeSyncTimeoutRef.current) {
        clearTimeout(resumeSyncTimeoutRef.current)
        resumeSyncTimeoutRef.current = null
      }
    }
  }, [selectorSyncSuspended])

  const currentMonth = months[activeMonthIndex]
  const currentYearNumber = currentMonth
    ? currentMonth.year
    : getYear(baseMonth)
  const currentMonthNumber = currentMonth
    ? getMonth(currentMonth.monthStart)
    : getMonth(baseMonth)
  const goToMonth = useCallback(
    (
      monthNumber: number,
      year: number,
      options: { behavior?: ScrollBehaviorOption } = {}
    ) => {
      const targetDate = startOfMonth(new Date(year, monthNumber, 1))
      const targetOffset = differenceInCalendarMonths(targetDate, baseMonth)

      setPendingScroll({
        offset: targetOffset,
        behavior: options.behavior,
      })

      setMonthRange(prev => {
        if (targetOffset >= prev.start && targetOffset <= prev.end) {
          return prev
        }

        return {
          start: Math.min(prev.start, targetOffset - MONTH_RANGE_PADDING),
          end: Math.max(prev.end, targetOffset + MONTH_RANGE_PADDING),
        }
      })
    },
    [baseMonth]
  )

  useEffect(() => {
    if (!pendingScroll) {
      return
    }

    const targetIndex = months.findIndex(
      month => month.offset === pendingScroll.offset
    )

    if (targetIndex === -1) {
      return
    }

    const { behavior } = pendingScroll

    const isRendered = virtualMonths.some(item => item.index === targetIndex)

    if (!isRendered) {
      monthVirtualizer.scrollToIndex(targetIndex, { align: 'start' })
      return
    }

    const scrollElement = containerRef.current
    if (!scrollElement) {
      return
    }

    const targetElement = scrollElement.querySelector<HTMLDivElement>(
      `[data-offset="${pendingScroll.offset}"]`
    )

    if (!targetElement) {
      monthVirtualizer.scrollToIndex(targetIndex, { align: 'start' })
      return
    }

    if (behavior === 'smooth') {
      setSelectorSyncSuspended(true)
    }

    requestAnimationFrame(() => {
      const headerHeight = headerRef.current
        ? headerRef.current.getBoundingClientRect().height
        : 0
      const containerRect = scrollElement.getBoundingClientRect()
      const elementRect = targetElement.getBoundingClientRect()
      const rawOffset =
        scrollElement.scrollTop + (elementRect.top - containerRect.top)
      const targetScrollTop = Math.max(
        0,
        rawOffset - headerHeight - MONTH_SCROLL_PADDING
      )

      scrollElement.scrollTo({
        top: targetScrollTop,
        behavior: behavior ?? 'auto',
      })

      const targetMonth = months[targetIndex]
      if (targetMonth) {
        setActiveMonthOffset(targetMonth.offset)
      }

      setSelectorSyncSuspended(false)
      setPendingScroll(null)
    })
  }, [monthVirtualizer, months, pendingScroll, virtualMonths])

  const handleSelectMonth = useCallback(
    (value: string) => {
      setMonthValue(value)
      const monthNumber = Number(value)
      if (Number.isNaN(monthNumber)) {
        return
      }
      goToMonth(monthNumber, currentYearNumber, { behavior: 'smooth' })
    },
    [currentYearNumber, goToMonth]
  )

  const commitYearChange = useCallback(() => {
    const parsedYear = Number(yearValue)
    if (!Number.isFinite(parsedYear)) {
      setYearValue(String(currentYearNumber))
      return
    }

    goToMonth(currentMonthNumber, parsedYear, { behavior: 'smooth' })
  }, [currentMonthNumber, currentYearNumber, goToMonth, yearValue])

  const handlePrevMonth = useCallback(() => {
    const current = months[activeMonthIndex]
    if (!current) {
      return
    }

    const previousMonthStart = addMonths(current.monthStart, -1)
    goToMonth(getMonth(previousMonthStart), getYear(previousMonthStart), {
      behavior: 'smooth',
    })
  }, [activeMonthIndex, goToMonth, months])

  const handleNextMonth = useCallback(() => {
    const current = months[activeMonthIndex]
    if (!current) {
      return
    }

    const nextMonthStart = addMonths(current.monthStart, 1)
    goToMonth(getMonth(nextMonthStart), getYear(nextMonthStart), {
      behavior: 'smooth',
    })
  }, [activeMonthIndex, goToMonth, months])

  const totalMonthHeight = monthVirtualizer.getTotalSize()

  const loadingVisible = isPending && !scrimLocked
  const disabledReason = canManageTasks
    ? null
    : 'You need manage permissions to add tasks.'

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
          onDragEnd={onDragEnd}
        >
          <div className='relative min-h-0 flex-1'>
            <div
              ref={containerRef}
              className='absolute inset-0 overflow-y-auto rounded-xl border'
            >
              <div className='flex min-h-0 flex-1 flex-col'>
                <div
                  ref={headerRef}
                  className='bg-card sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-t-xl px-4 py-3 shadow-sm'
                >
                  <div className='flex items-center gap-2'>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      onClick={handlePrevMonth}
                      aria-label='View previous month'
                      disabled={activeMonthIndex === 0}
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      onClick={handleNextMonth}
                      aria-label='View next month'
                      disabled={activeMonthIndex === months.length - 1}
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </div>
                  <Select value={monthValue} onValueChange={handleSelectMonth}>
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
                    className='flex items-center gap-2'
                    onSubmit={event => {
                      event.preventDefault()
                      commitYearChange()
                    }}
                  >
                    <label className='text-muted-foreground text-sm font-medium'>
                      Year
                      <Input
                        value={yearValue}
                        onChange={event => setYearValue(event.target.value)}
                        onBlur={commitYearChange}
                        inputMode='numeric'
                        className='ml-2 w-24'
                        aria-label='Select year'
                      />
                    </label>
                  </form>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      goToMonth(getMonth(baseMonth), getYear(baseMonth), {
                        behavior: 'smooth',
                      })
                      requestAnimationFrame(() => {
                        todayCellRef.current?.scrollIntoView({
                          block: 'center',
                          behavior: 'smooth',
                        })
                      })
                    }}
                  >
                    Today
                  </Button>
                </div>
                <div className='bg-card relative flex min-h-0 flex-1 overflow-hidden'>
                  <div className='flex-1'>
                    <div
                      style={{
                        height: totalMonthHeight,
                        position: 'relative',
                        width: '100%',
                      }}
                    >
                      {virtualMonths.map(virtualMonth => {
                        const month = months[virtualMonth.index]
                        if (!month) {
                          return null
                        }

                        const days = buildCalendarDays(month, todayKey)

                        return (
                          <div
                            key={virtualMonth.key}
                            ref={measureMonthElement}
                            data-index={`${virtualMonth.index}`}
                            data-offset={month.offset}
                            className={cn(
                              'border-border/60 border-b px-4 py-6',
                              virtualMonth.index === months.length - 1 &&
                                'border-none'
                            )}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translate3d(0, ${virtualMonth.start}px, 0)`,
                            }}
                          >
                            <div className='mb-4 flex items-baseline justify-between'>
                              <div>
                                <p className='text-lg font-semibold'>
                                  {month.label} {month.year}
                                </p>
                                <p className='text-muted-foreground text-xs'>
                                  Weeks begin on Sunday and include weekends.
                                </p>
                              </div>
                            </div>
                            <div className='grid grid-cols-7 gap-2'>
                              {days.map((day, dayIndex) => (
                                <CalendarDayCell
                                  key={day.key}
                                  day={day}
                                  canManageTasks={canManageTasks}
                                  onCreateTask={onCreateTask}
                                  disabledReason={disabledReason}
                                  tasks={tasksByDate.get(day.key) ?? []}
                                  onEditTask={onEditTask}
                                  renderAssignees={renderAssignees}
                                  todayCellRef={
                                    day.isToday ? todayCellRef : undefined
                                  }
                                  gridColumnStart={
                                    dayIndex === 0
                                      ? month.firstWeekdayIndex + 1
                                      : undefined
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
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
  gridColumnStart?: number
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
  gridColumnStart,
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
      style={gridColumnStart ? { gridColumnStart } : undefined}
      className={cn(
        'bg-background/80 flex h-full min-h-[140px] flex-col gap-2 rounded-lg border p-2 text-xs transition-shadow',
        !day.isCurrentMonth && 'bg-muted/20 text-muted-foreground',
        day.isWeekend && 'bg-secondary/40',
        day.isToday && 'border-primary shadow-sm',
        isOver && 'border-primary ring-primary/40 ring-2'
      )}
    >
      <div className='flex items-center justify-between'>
        <span className='text-sm font-semibold'>{day.label}</span>
        {canManageTasks ? (
          addButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{addButton}</TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className='flex flex-col gap-1 overflow-y-auto pr-1'>
        {tasks.map(task => (
          <CalendarTaskCard
            key={task.id}
            task={task}
            canManageTasks={canManageTasks}
            onEditTask={onEditTask}
            renderAssignees={renderAssignees}
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
}

function CalendarTaskCard({
  task,
  canManageTasks,
  onEditTask,
  renderAssignees,
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

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role='button'
      tabIndex={0}
      onClick={() => onEditTask(task)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEditTask(task)
        }
      }}
      className={cn(
        'bg-background rounded-md border px-2 py-1 text-left text-xs shadow-sm transition',
        canManageTasks ? 'hover:bg-primary/5 cursor-pointer' : 'cursor-default',
        isDragging && 'border-primary ring-primary/40 ring-2'
      )}
    >
      <p className='line-clamp-2 font-medium'>{task.title}</p>
      <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]'>
        <span>{primaryAssignee}</span>
      </div>
    </div>
  )
}
