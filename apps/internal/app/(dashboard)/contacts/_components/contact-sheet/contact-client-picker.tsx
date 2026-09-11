'use client'

import { useState } from 'react'
import { Building2, Plus, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { CommandCreateRows } from '@/components/ui/command-create-rows'
import { SheetEmptyState } from '@/components/sheets/sheet-empty-state'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'

export type ContactClientOption = {
  id: string
  name: string
  slug: string
}

export type ContactClientLinkButtonProps = {
  availableClients: ContactClientOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  onPickerOpenChange: (open: boolean) => void
  onAddClient: (client: ContactClientOption) => void
  /** Open the client create sheet, prefilled with the typed query. */
  onCreateClient: (query: string) => void
}

/** The "Link client" popover trigger — sits on the Clients section title row. */
export function ContactClientLinkButton({
  availableClients,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  onPickerOpenChange,
  onAddClient,
  onCreateClient,
}: ContactClientLinkButtonProps) {
  const [query, setQuery] = useState('')

  return (
    <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange} modal>
      <DisabledFieldTooltip
        disabled={disabled}
        reason={disabledReason}
        className='w-auto'
      >
        <PopoverTrigger asChild>
          <Button type='button' variant='outline' size='xs' disabled={disabled}>
            <Plus />
            Link client
          </Button>
        </PopoverTrigger>
      </DisabledFieldTooltip>
      <PopoverContent className='w-72 p-0' align='end'>
        <Command>
          <CommandInput
            placeholder='Search clients...'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup heading='Clients'>
              {availableClients.map(client => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => {
                    if (isPending) {
                      return
                    }
                    onAddClient(client)
                  }}
                >
                  <div className='flex items-center gap-2'>
                    <Building2 className='text-muted-foreground h-4 w-4' />
                    <span className='font-medium'>{client.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandCreateRows
              query={query}
              entityLabel='client'
              onCreate={onCreateClient}
            />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export type ContactClientListProps = {
  selectedClients: ContactClientOption[]
  isPending: boolean
  pendingReason: string
  onRequestRemoval: (client: ContactClientOption) => void
  /** Empty state: opens the same picker as the header's "Link client". */
  onRequestLink: () => void
  linkDisabled: boolean
  linkDisabledReason: string | null
}

/** The linked clients, one row each, with the unlink control on the right. */
export function ContactClientList({
  selectedClients,
  isPending,
  pendingReason,
  onRequestRemoval,
  onRequestLink,
  linkDisabled,
  linkDisabledReason,
}: ContactClientListProps) {
  if (selectedClients.length === 0) {
    return (
      <DisabledFieldTooltip disabled={linkDisabled} reason={linkDisabledReason}>
        <SheetEmptyState
          message='No clients linked yet.'
          label='Link client'
          onClick={onRequestLink}
          disabled={linkDisabled}
        />
      </DisabledFieldTooltip>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {selectedClients.map(client => (
        <div
          key={client.id}
          className='bg-muted/40 flex items-center justify-between gap-3 rounded-md border py-1.5 pr-1.5 pl-3'
        >
          <div className='flex min-w-0 items-center gap-2 text-sm leading-tight'>
            <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
            <span className='truncate font-medium'>{client.name}</span>
          </div>
          <DisabledFieldTooltip
            disabled={isPending}
            reason={isPending ? pendingReason : null}
            className='w-auto'
          >
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-destructive h-8 w-8 shrink-0'
              onClick={() => onRequestRemoval(client)}
              disabled={isPending}
              aria-label={`Unlink ${client.name}`}
            >
              <X className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        </div>
      ))}
    </div>
  )
}
