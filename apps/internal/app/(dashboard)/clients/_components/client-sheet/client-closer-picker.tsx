'use client'

import { ChevronsUpDown, Handshake, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'

import type { PartnerUserOption } from '@/lib/settings/clients/use-client-sheet-state'

export type ClientCloserPickerProps = {
  selectedCloser: PartnerUserOption | null
  availableClosers: PartnerUserOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onSelect: (user: PartnerUserOption) => void
  onClear: () => void
}

function displayName(user: PartnerUserOption): string {
  return user.fullName?.trim() || user.email
}

export function ClientCloserPicker({
  selectedCloser,
  availableClosers,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onSelect,
  onClear,
}: ClientCloserPickerProps) {
  if (selectedCloser) {
    return (
      <div className='bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2'>
        <Handshake className='text-muted-foreground h-4 w-4 shrink-0' />
        <div className='flex min-w-0 flex-1 flex-col text-sm leading-tight'>
          <span className='truncate font-medium'>
            {displayName(selectedCloser)}
          </span>
          {selectedCloser.fullName ? (
            <span className='text-muted-foreground truncate text-xs'>
              {selectedCloser.email}
            </span>
          ) : null}
        </div>
        <DisabledFieldTooltip
          disabled={isPending || disabled}
          reason={isPending ? pendingReason : disabledReason}
        >
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='text-muted-foreground hover:text-destructive h-8 w-8 shrink-0'
            onClick={onClear}
            disabled={isPending || disabled}
            aria-label={`Clear closer ${displayName(selectedCloser)}`}
          >
            <X className='h-4 w-4' />
          </Button>
        </DisabledFieldTooltip>
      </div>
    )
  }

  const hasNoUsers = availableClosers.length === 0

  return (
    <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange} modal>
      <DisabledFieldTooltip
        disabled={disabled || hasNoUsers}
        reason={
          disabledReason ?? (hasNoUsers ? 'No admin users available' : null)
        }
      >
        <div className='w-full'>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-between'
              disabled={disabled || hasNoUsers}
            >
              <span className='flex items-center gap-2'>
                <Handshake className='h-4 w-4' />
                No closer
              </span>
              <ChevronsUpDown className='h-4 w-4 opacity-50' />
            </Button>
          </PopoverTrigger>
        </div>
      </DisabledFieldTooltip>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
      >
        <Command>
          <CommandInput placeholder='Search admin users...' />
          <CommandEmpty>No matching users.</CommandEmpty>
          <CommandList>
            <CommandGroup heading='Admin users'>
              {availableClosers.map(user => (
                <CommandItem
                  key={user.id}
                  value={`${user.fullName ?? ''} ${user.email}`}
                  onSelect={() => {
                    if (isPending) return
                    onSelect(user)
                  }}
                >
                  <div className='flex flex-col'>
                    <span className='font-medium'>
                      {user.fullName ?? user.email}
                    </span>
                    {user.fullName ? (
                      <span className='text-muted-foreground text-xs'>
                        {user.email}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
