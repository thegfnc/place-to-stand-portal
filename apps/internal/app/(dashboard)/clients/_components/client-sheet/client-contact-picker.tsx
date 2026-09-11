'use client'

import { useState } from 'react'
import { Plus, UserCheck, X } from 'lucide-react'

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

type ClientContactOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  hasPortalAccess: boolean
}

function PortalAccessMark() {
  return (
    <span title='Has portal access'>
      <UserCheck className='h-3 w-3 text-emerald-500' />
    </span>
  )
}

export type ClientContactLinkButtonProps = {
  availableContacts: ClientContactOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  onPickerOpenChange: (open: boolean) => void
  onAddContact: (contact: ClientContactOption) => void
  /** Open the contact create sheet, prefilled with the typed query. */
  onCreateContact: (query: string) => void
}

/** The "Link contact" popover trigger — sits on the Contacts section title row. */
export function ClientContactLinkButton({
  availableContacts,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  onPickerOpenChange,
  onAddContact,
  onCreateContact,
}: ClientContactLinkButtonProps) {
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
            Link contact
          </Button>
        </PopoverTrigger>
      </DisabledFieldTooltip>
      <PopoverContent className='w-72 p-0' align='end'>
        <Command>
          <CommandInput
            placeholder='Search contacts...'
            value={query}
            onValueChange={setQuery}
          />
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
                    <span className='flex items-center gap-1.5 font-medium'>
                      {contact.name ?? contact.email}
                      {contact.hasPortalAccess ? <PortalAccessMark /> : null}
                    </span>
                    {contact.name ? (
                      <span className='text-muted-foreground text-xs'>
                        {contact.email}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandCreateRows
              query={query}
              entityLabel='contact'
              onCreate={onCreateContact}
            />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export type ClientContactListProps = {
  selectedContacts: ClientContactOption[]
  isPending: boolean
  pendingReason: string
  onRequestRemoval: (contact: ClientContactOption) => void
  /** Empty state: opens the same picker as the header's "Link contact". */
  onRequestLink: () => void
  linkDisabled: boolean
  linkDisabledReason: string | null
}

/** The linked contacts, one row each, with the unlink control on the right. */
export function ClientContactList({
  selectedContacts,
  isPending,
  pendingReason,
  onRequestRemoval,
  onRequestLink,
  linkDisabled,
  linkDisabledReason,
}: ClientContactListProps) {
  if (selectedContacts.length === 0) {
    return (
      <DisabledFieldTooltip disabled={linkDisabled} reason={linkDisabledReason}>
        <SheetEmptyState
          message='No contacts linked yet.'
          label='Link contact'
          onClick={onRequestLink}
          disabled={linkDisabled}
        />
      </DisabledFieldTooltip>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {selectedContacts.map(contact => (
        <div
          key={contact.id}
          className='bg-muted/40 flex items-center justify-between gap-3 rounded-md border py-1.5 pr-1.5 pl-3'
        >
          <div className='flex min-w-0 flex-col text-sm leading-tight'>
            <span className='flex items-center gap-1.5 font-medium'>
              {contact.name ?? contact.email}
              {contact.hasPortalAccess ? <PortalAccessMark /> : null}
            </span>
            {contact.name || contact.phone ? (
              <span className='text-muted-foreground truncate text-xs'>
                {[contact.name ? contact.email : null, contact.phone]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            ) : null}
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
              onClick={() => onRequestRemoval(contact)}
              disabled={isPending}
              aria-label={`Unlink ${contact.name ?? contact.email}`}
            >
              <X className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        </div>
      ))}
    </div>
  )
}
