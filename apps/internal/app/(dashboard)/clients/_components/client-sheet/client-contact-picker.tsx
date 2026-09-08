'use client'

import { ChevronsUpDown, UserCheck, Users, X } from 'lucide-react'

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@pts/ui/popover'

type ClientContactOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  hasPortalAccess: boolean
}

const assignedContainerClass =
  'bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'

const iconButtonClass = 'text-muted-foreground hover:text-destructive'

export type ClientContactPickerProps = {
  selectedContacts: ClientContactOption[]
  availableContacts: ClientContactOption[]
  addButtonDisabled: boolean
  addButtonDisabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onAddContact: (contact: ClientContactOption) => void
  onRequestRemoval: (contact: ClientContactOption) => void
}

export function ClientContactPicker({
  selectedContacts,
  availableContacts,
  addButtonDisabled,
  addButtonDisabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onAddContact,
  onRequestRemoval,
}: ClientContactPickerProps) {
  return (
    <div className='space-y-2'>
      <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange} modal>
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
                  <Users className='h-4 w-4' />
                  {availableContacts.length > 0
                    ? 'Link contact'
                    : 'All contacts linked'}
                </span>
                <ChevronsUpDown className='h-4 w-4 opacity-50' />
              </Button>
            </PopoverTrigger>
          </div>
        </DisabledFieldTooltip>
        <PopoverContent className='w-[var(--radix-popover-trigger-width)] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Search contacts...' />
            <CommandEmpty>No matching contacts.</CommandEmpty>
            <CommandList>
              <CommandGroup heading='Contacts'>
                {availableContacts.map(contact => (
                  <CommandItem
                    key={contact.id}
                    value={`${contact.name ?? ''} ${contact.email}`}
                    onSelect={() => {
                      if (isPending) {
                        return
                      }
                      onAddContact(contact)
                    }}
                  >
                    <div className='flex flex-col'>
                      {contact.name ? (
                        <>
                          <span className='flex items-center gap-1.5 font-medium'>
                            {contact.name}
                            {contact.hasPortalAccess && (
                              <span title='Has portal access'><UserCheck className='h-3 w-3 text-emerald-500' /></span>
                            )}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            {contact.email}
                          </span>
                        </>
                      ) : (
                        <span className='flex items-center gap-1.5 font-medium'>
                          {contact.email}
                          {contact.hasPortalAccess && (
                            <span title='Has portal access'><UserCheck className='h-3 w-3 text-emerald-500' /></span>
                          )}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className='text-muted-foreground text-xs'>
        Link contacts to this client for easy access.
      </p>
      <div className='space-y-2'>
        {selectedContacts.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No contacts linked yet.
          </p>
        ) : (
          selectedContacts.map(contact => (
            <div key={contact.id} className={assignedContainerClass}>
              <div className='flex flex-col text-sm leading-tight'>
                {contact.name ? (
                  <>
                    <span className='flex items-center gap-1.5 font-medium'>
                      {contact.name}
                      {contact.hasPortalAccess && (
                        <span title='Has portal access'><UserCheck className='h-3 w-3 text-emerald-500' /></span>
                      )}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {contact.email}
                    </span>
                  </>
                ) : (
                  <span className='flex items-center gap-1.5 font-medium'>
                    {contact.email}
                    {contact.hasPortalAccess && (
                      <span title='Has portal access'><UserCheck className='h-3 w-3 text-emerald-500' /></span>
                    )}
                  </span>
                )}
                {contact.phone ? (
                  <span className='text-muted-foreground text-xs'>
                    {contact.phone}
                  </span>
                ) : null}
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
                  onClick={() => onRequestRemoval(contact)}
                  disabled={isPending}
                  aria-label={`Unlink ${contact.name ?? contact.email}`}
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
