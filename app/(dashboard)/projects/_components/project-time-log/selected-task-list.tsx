import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { TaskWithRelations } from '@/lib/types'

import { formatTaskStatusLabel } from './task-status-utils'

export type SelectedTaskListProps = {
  tasks: TaskWithRelations[]
  isActionDisabled: boolean
  disabledReason: string | null
  onRemove: (task: TaskWithRelations) => void
}

export function SelectedTaskList(props: SelectedTaskListProps) {
  const { tasks, isActionDisabled, disabledReason, onRemove } = props

  if (tasks.length === 0) {
    return null
  }

  return (
    <div className='space-y-2'>
      {tasks.map(task => {
        const formattedStatus = formatTaskStatusLabel(task.status)

        return (
          <div
            key={task.id}
            className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
          >
            <div className='flex flex-col text-sm leading-tight'>
              <span className='font-medium'>{task.title}</span>
              {formattedStatus ? (
                <span className='text-muted-foreground text-xs'>
                  {formattedStatus}
                </span>
              ) : null}
            </div>
            <DisabledFieldTooltip
              disabled={isActionDisabled}
              reason={disabledReason}
            >
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive'
                onClick={() => onRemove(task)}
                disabled={isActionDisabled}
                aria-label={`Remove ${task.title}`}
              >
                <X className='h-4 w-4' />
              </Button>
            </DisabledFieldTooltip>
          </div>
        )
      })}
    </div>
  )
}
