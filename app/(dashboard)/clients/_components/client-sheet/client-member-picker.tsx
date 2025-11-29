'use client'

import { ChevronsUpDown, UserPlus, X } from 'lucide-react'

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

import { CLIENT_MEMBERS_HELP_TEXT } from '@/lib/settings/clients/client-sheet-constants'
import type { ClientMemberOption } from '@/lib/settings/clients/use-client-sheet-state'

const assignedContainerClass =
  'bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'

const iconButtonClass = 'text-muted-foreground hover:text-destructive'

export type ClientMemberPickerProps = {
  selectedMembers: ClientMemberOption[]
  availableMembers: ClientMemberOption[]
  addButtonDisabled: boolean
  addButtonDisabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onAddMember: (member: ClientMemberOption) => void
  onRequestRemoval: (member: ClientMemberOption) => void
}

export function ClientMemberPicker({
  selectedMembers,
  availableMembers,
  addButtonDisabled,
  addButtonDisabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onAddMember,
  onRequestRemoval,
}: ClientMemberPickerProps) {
  return (
    <div className='space-y-2'>
      <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange}>
        <DisabledFieldTooltip
          disabled={addButtonDisabled}
          reason={addButtonDisabledReason}
        >
          <div className='w-full'>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                className='w-full justify-between'
                disabled={addButtonDisabled}
              >
                <span className='flex items-center gap-2'>
                  <UserPlus className='h-4 w-4' />
                  {availableMembers.length > 0
                    ? 'Add client user'
                    : 'All client users assigned'}
                </span>
                <ChevronsUpDown className='h-4 w-4 opacity-50' />
              </Button>
            </PopoverTrigger>
          </div>
        </DisabledFieldTooltip>
        <PopoverContent className='w-[320px] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Search client users...' />
            <CommandEmpty>No matching client users.</CommandEmpty>
            <CommandList>
              <CommandGroup heading='Client users'>
                {availableMembers.map(user => (
                  <CommandItem
                    key={user.id}
                    value={`${user.displayName} ${user.email}`}
                    onSelect={() => {
                      if (isPending) {
                        return
                      }
                      onAddMember(user)
                    }}
                  >
                    <div className='flex flex-col'>
                      <span className='font-medium'>{user.displayName}</span>
                      <span className='text-muted-foreground text-xs'>
                        {user.email}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className='text-muted-foreground text-xs'>
        {CLIENT_MEMBERS_HELP_TEXT}
      </p>
      <div className='space-y-2'>
        {selectedMembers.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No client users assigned yet.
          </p>
        ) : (
          selectedMembers.map(user => (
            <div key={user.id} className={assignedContainerClass}>
              <div className='flex flex-col text-sm leading-tight'>
                <span className='font-medium'>{user.displayName}</span>
                <span className='text-muted-foreground text-xs'>
                  {user.email}
                </span>
              </div>
              <DisabledFieldTooltip
                disabled={isPending}
                reason={isPending ? pendingReason : null}
              >
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className={iconButtonClass}
                  onClick={() => onRequestRemoval(user)}
                  disabled={isPending}
                  aria-label={`Remove ${user.displayName}`}
                >
                  <X className='h-4 w-4' />
                </Button>
              </DisabledFieldTooltip>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
