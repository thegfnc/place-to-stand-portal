import { forwardRef, type ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'

type CalendarTaskCardShellProps = {
  task: TaskWithRelations
  primaryAssignee: string
  canManageTasks: boolean
  isActive?: boolean
  isDragging?: boolean
  hideWhileDragging?: boolean
} & ComponentPropsWithoutRef<'div'>

export const CalendarTaskCardShell = forwardRef<
  HTMLDivElement,
  CalendarTaskCardShellProps
>(function CalendarTaskCardShell(
  {
    task,
    primaryAssignee,
    canManageTasks,
    isActive = false,
    isDragging = false,
    hideWhileDragging = false,
    className,
    ...rest
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-card rounded-md border-y border-r border-l-4 border-l-violet-500 px-2 py-1 text-left text-xs shadow-sm transition',
        canManageTasks
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-pointer',
        (isActive || isDragging) && 'border-primary/50 bg-primary/5 shadow-md',
        !isActive &&
          !isDragging &&
          'hover:border-r-violet-500/50 hover:border-y-violet-500/50 hover:bg-violet-500/5 hover:shadow-md',
        isDragging && 'ring-primary ring-2',
        hideWhileDragging && isDragging && 'pointer-events-none opacity-0',
        className
      )}
      {...rest}
    >
      <p className='line-clamp-2 font-medium'>{task.title}</p>
      <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]'>
        <span>{primaryAssignee}</span>
      </div>
    </div>
  )
})

export type CalendarTaskCardPreviewProps = {
  task: TaskWithRelations
  assignees: Array<{ id: string; name: string }>
}

export function CalendarTaskCardPreview({
  task,
  assignees,
}: CalendarTaskCardPreviewProps) {
  const primaryAssignee = assignees[0]?.name ?? 'Unassigned'

  return (
    <CalendarTaskCardShell
      task={task}
      primaryAssignee={primaryAssignee}
      canManageTasks
      className='pointer-events-none'
    />
  )
}
