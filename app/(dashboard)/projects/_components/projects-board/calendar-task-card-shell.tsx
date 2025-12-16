import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'

type CalendarTaskCardShellProps = {
  task: TaskWithRelations
  primaryAssignee: string
  primaryAssigneeId?: string | null
  primaryAssigneeAvatarUrl?: string | null
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
    primaryAssigneeId,
    primaryAssigneeAvatarUrl,
    canManageTasks,
    isActive = false,
    isDragging = false,
    hideWhileDragging = false,
    className,
    ...rest
  },
  ref
) {
  const isCompleted = task.status === 'DONE' || task.status === 'ARCHIVED'

  return (
    <div
      ref={ref}
      className={cn(
        'bg-card rounded-md border-y border-r border-l-4 px-2 py-1 text-left text-xs shadow-sm transition',
        isCompleted
          ? 'border-l-muted-foreground/30 opacity-65'
          : 'border-l-violet-500',
        canManageTasks
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-pointer',
        (isActive || isDragging) && 'border-primary/50 bg-primary/5 shadow-md',
        !isActive &&
          !isDragging &&
          !isCompleted &&
          'hover:border-y-violet-500/50 hover:border-r-violet-500/50 hover:bg-violet-500/5 hover:shadow-md',
        !isActive &&
          !isDragging &&
          isCompleted &&
          'hover:border-r-muted-foreground/30 hover:border-y-muted-foreground/30 hover:bg-muted/20 hover:shadow-md',
        isDragging && 'ring-primary ring-2',
        hideWhileDragging && isDragging && 'pointer-events-none opacity-0',
        className
      )}
      {...rest}
    >
      <p
        className={cn(
          'line-clamp-2 font-medium',
          isCompleted && 'line-through'
        )}
      >
        {task.title}
      </p>
      <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-[11px]'>
        {primaryAssigneeId ? (
          <Avatar className='h-3.5 w-3.5'>
            {primaryAssigneeAvatarUrl && (
              <AvatarImage src={`/api/storage/user-avatar/${primaryAssigneeId}`} />
            )}
            <AvatarFallback className='text-[7px]'>
              {primaryAssignee.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <User className='h-3 w-3' />
        )}
        <span>{primaryAssignee}</span>
      </div>
    </div>
  )
})

export type CalendarTaskCardPreviewProps = {
  task: TaskWithRelations
  assignees: Array<{ id: string; name: string; avatarUrl: string | null }>
}

export function CalendarTaskCardPreview({
  task,
  assignees,
}: CalendarTaskCardPreviewProps) {
  const primaryAssignee = assignees[0]?.name ?? 'Unassigned'
  const primaryAssigneeId = assignees[0]?.id ?? null
  const primaryAssigneeAvatarUrl = assignees[0]?.avatarUrl ?? null

  return (
    <CalendarTaskCardShell
      task={task}
      primaryAssignee={primaryAssignee}
      primaryAssigneeId={primaryAssigneeId}
      primaryAssigneeAvatarUrl={primaryAssigneeAvatarUrl}
      canManageTasks
      className='pointer-events-none'
    />
  )
}
