'use client'

import { User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'

export type CardAssignee = {
  id: string
  name: string
  avatarUrl: string | null
}

const MAX_VISIBLE = 3

/**
 * The bottom-right assignee stack shared by the board cards. Avatars only —
 * names live in the tooltip — so the stack costs the card no vertical room
 * and reads the same on every board, including a person's own My Tasks.
 */
export function CardAssigneeAvatars({
  assignees,
  className,
}: {
  assignees: CardAssignee[]
  className?: string
}) {
  if (assignees.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'text-muted-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center',
              className
            )}
            aria-label='Unassigned'
          >
            <User className='h-3.5 w-3.5' aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent side='top'>Unassigned</TooltipContent>
      </Tooltip>
    )
  }

  const visible = assignees.slice(0, MAX_VISIBLE)
  const overflow = assignees.length - visible.length
  const names = assignees.map(assignee => assignee.name).join(', ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('flex shrink-0 items-center -space-x-1.5', className)}
          aria-label={`Assigned to ${names}`}
        >
          {visible.map(assignee => (
            <Avatar key={assignee.id} className='ring-card h-5 w-5 ring-2'>
              {assignee.avatarUrl && (
                <AvatarImage src={`/api/storage/user-avatar/${assignee.id}`} />
              )}
              <AvatarFallback className='text-[8px]'>
                {assignee.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {overflow > 0 ? (
            <span className='bg-muted text-muted-foreground ring-card inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-medium ring-2'>
              +{overflow}
            </span>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent side='top'>{names}</TooltipContent>
    </Tooltip>
  )
}
