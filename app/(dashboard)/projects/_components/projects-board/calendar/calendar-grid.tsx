'use client'

import { useMemo, type RefObject } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '@/lib/projects/board/board-selectors'
import { CalendarTaskCardShell } from '../calendar-task-card-shell'
import type {
  CalendarDay,
  CalendarWeekdayHeader,
} from '@/lib/projects/calendar/calendar-helpers'

type CalendarGridProps = {
  days: CalendarDay[]
  weekdayHeaders: CalendarWeekdayHeader[]
  tasksByDate: Map<string, TaskWithRelations[]>
  canManageTasks: boolean
  onCreateTask: (dueOn: string) => void
  disabledReason: string | null
  onEditTask: (task: TaskWithRelations) => void
  renderAssignees: RenderAssigneeFn
  activeTaskId: string | null
  todayCellRef: RefObject<HTMLDivElement | null>
  enableTaskCreation?: boolean
}

const EMPTY_TASKS: TaskWithRelations[] = []

export function CalendarGrid({
  days,
  weekdayHeaders,
  tasksByDate,
  canManageTasks,
  onCreateTask,
  disabledReason,
  onEditTask,
  renderAssignees,
  activeTaskId,
  todayCellRef,
  enableTaskCreation = true,
}: CalendarGridProps) {
  return (
    <div className='flex-1 px-4 py-6'>
      <div className='grid grid-cols-7 gap-2 text-center text-xs font-semibold tracking-wide uppercase'>
        {weekdayHeaders.map(({ label, isWeekend }) => (
          <span
            key={label}
            className={cn(
              'text-muted-foreground rounded-md px-2 py-1',
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
            tasks={tasksByDate.get(day.key) ?? EMPTY_TASKS}
            onEditTask={onEditTask}
            renderAssignees={renderAssignees}
            activeTaskId={activeTaskId}
            todayCellRef={day.isToday ? todayCellRef : undefined}
            enableTaskCreation={enableTaskCreation}
          />
        ))}
      </div>
    </div>
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
  enableTaskCreation: boolean
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
  enableTaskCreation,
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
        'border-border bg-background flex h-full min-h-[140px] flex-col gap-2 rounded-lg border p-2 text-xs transition-shadow',
        !day.isCurrentMonth &&
          'border-muted-foreground/40 bg-muted/60 text-muted-foreground border-dashed',
        day.isWeekend &&
          (day.isCurrentMonth ? 'bg-secondary/20' : 'bg-secondary/10'),
        day.isWeekend && 'ring-secondary/30 ring-1',
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
          enableTaskCreation ? (
          addButton
          ) : null
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
