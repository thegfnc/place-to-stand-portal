import { ChevronsUpDown, ListPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { TaskWithRelations } from '@/lib/types'

import { formatTaskStatusLabel } from './task-status-utils'

export type TaskSelectorProps = {
  availableTasks: TaskWithRelations[]
  onAddTask: (taskId: string) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  disabled: boolean
  disabledReason: string | null
}

export function TaskSelector(props: TaskSelectorProps) {
  const {
    availableTasks,
    onAddTask,
    isOpen,
    onOpenChange,
    disabled,
    disabledReason,
  } = props

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
        <div className='w-full'>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-between'
              disabled={disabled}
            >
              <span className='flex items-center gap-2'>
                <ListPlus className='h-4 w-4' />
                {availableTasks.length > 0
                  ? 'Add task link'
                  : 'All tasks linked'}
              </span>
              <ChevronsUpDown className='h-4 w-4 opacity-50' />
            </Button>
          </PopoverTrigger>
        </div>
      </DisabledFieldTooltip>
      <PopoverContent className='w-[320px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='Search tasks...' />
          <CommandEmpty>No matching tasks.</CommandEmpty>
          <CommandList>
            <CommandGroup heading='Tasks'>
              {availableTasks.map(task => {
                const formattedStatus = formatTaskStatusLabel(task.status)

                return (
                  <CommandItem
                    key={task.id}
                    value={`${task.title} ${task.id}`}
                    onSelect={() => {
                      onAddTask(task.id)
                      onOpenChange(false)
                    }}
                  >
                    <div className='flex flex-col'>
                      <span className='font-medium'>{task.title}</span>
                      {formattedStatus ? (
                        <span className='text-muted-foreground text-xs'>
                          {formattedStatus}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
