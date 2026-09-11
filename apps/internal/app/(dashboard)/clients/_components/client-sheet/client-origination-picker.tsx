'use client'

import { ChevronsUpDown, LinkIcon, User2, X } from 'lucide-react'

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
import { cn } from '@/lib/utils'

import type {
  OriginationContactOption,
  OriginationMode,
  PartnerUserOption,
} from '@/lib/settings/clients/use-client-sheet-state'

export type ClientOriginationPickerProps = {
  mode: OriginationMode
  selectedUser: PartnerUserOption | null
  selectedContact: OriginationContactOption | null
  availableUsers: PartnerUserOption[]
  availableContacts: OriginationContactOption[]
  disabled: boolean
  disabledReason: string | null
  isUserPickerOpen: boolean
  isContactPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onUserPickerOpenChange: (open: boolean) => void
  onContactPickerOpenChange: (open: boolean) => void
  onSelectUser: (user: PartnerUserOption) => void
  onSelectContact: (contact: OriginationContactOption) => void
  onClear: () => void
}

function UserDisplayName(user: PartnerUserOption): string {
  return user.fullName?.trim() || user.email
}

type ClientOriginationModeToggleProps = {
  mode: OriginationMode
  disabled: boolean
  onModeChange: (mode: OriginationMode) => void
}

/** The internal/external switch — rendered on the field's label row. */
export function ClientOriginationModeToggle({
  mode,
  disabled,
  onModeChange,
}: ClientOriginationModeToggleProps) {
  return (
    <div
      role='tablist'
      aria-label='Origination source type'
      className='bg-muted inline-flex rounded-md p-0.5 text-xs'
    >
      <Button
        type='button'
        role='tab'
        size='sm'
        variant='ghost'
        aria-selected={mode === 'internal'}
        className={cn(
          'h-7 rounded-sm px-3 text-xs font-medium',
          mode === 'internal'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        disabled={disabled}
        onClick={() => onModeChange('internal')}
      >
        <User2 className='h-3.5 w-3.5' />
        Internal partner
      </Button>
      <Button
        type='button'
        role='tab'
        size='sm'
        variant='ghost'
        aria-selected={mode === 'external'}
        className={cn(
          'h-7 rounded-sm px-3 text-xs font-medium',
          mode === 'external'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        disabled={disabled}
        onClick={() => onModeChange('external')}
      >
        <LinkIcon className='h-3.5 w-3.5' />
        External referrer
      </Button>
    </div>
  )
}

export function ClientOriginationPicker({
  mode,
  selectedUser,
  selectedContact,
  availableUsers,
  availableContacts,
  disabled,
  disabledReason,
  isUserPickerOpen,
  isContactPickerOpen,
  isPending,
  pendingReason,
  onUserPickerOpenChange,
  onContactPickerOpenChange,
  onSelectUser,
  onSelectContact,
  onClear,
}: ClientOriginationPickerProps) {
  if (mode === 'internal') {
    return (
      <InternalPartnerPicker
        selectedUser={selectedUser}
        availableUsers={availableUsers}
        disabled={disabled}
        disabledReason={disabledReason}
        isPickerOpen={isUserPickerOpen}
        isPending={isPending}
        pendingReason={pendingReason}
        onPickerOpenChange={onUserPickerOpenChange}
        onSelect={onSelectUser}
        onClear={onClear}
      />
    )
  }

  return (
    <ExternalReferrerPicker
      selectedContact={selectedContact}
      availableContacts={availableContacts}
      disabled={disabled}
      disabledReason={disabledReason}
      isPickerOpen={isContactPickerOpen}
      isPending={isPending}
      pendingReason={pendingReason}
      onPickerOpenChange={onContactPickerOpenChange}
      onSelect={onSelectContact}
      onClear={onClear}
    />
  )
}

// ----------------------------------------------------------------------
// Internal partner picker (admin users)
// ----------------------------------------------------------------------

type InternalPartnerPickerProps = {
  selectedUser: PartnerUserOption | null
  availableUsers: PartnerUserOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onSelect: (user: PartnerUserOption) => void
  onClear: () => void
}

function InternalPartnerPicker({
  selectedUser,
  availableUsers,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onSelect,
  onClear,
}: InternalPartnerPickerProps) {
  if (selectedUser) {
    return (
      <div className='bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2'>
        <User2 className='text-muted-foreground h-4 w-4 shrink-0' />
        <div className='flex min-w-0 flex-1 flex-col text-sm leading-tight'>
          <span className='truncate font-medium'>
            {UserDisplayName(selectedUser)}
          </span>
          {selectedUser.fullName ? (
            <span className='text-muted-foreground truncate text-xs'>
              {selectedUser.email}
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
            aria-label={`Clear internal origination ${UserDisplayName(selectedUser)}`}
          >
            <X className='h-4 w-4' />
          </Button>
        </DisabledFieldTooltip>
      </div>
    )
  }

  const hasNoUsers = availableUsers.length === 0

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
                <User2 className='h-4 w-4' />
                Select internal partner
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
              {availableUsers.map(user => (
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

// ----------------------------------------------------------------------
// External referrer picker (contacts)
// ----------------------------------------------------------------------

type ExternalReferrerPickerProps = {
  selectedContact: OriginationContactOption | null
  availableContacts: OriginationContactOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onSelect: (contact: OriginationContactOption) => void
  onClear: () => void
}

function ExternalReferrerPicker({
  selectedContact,
  availableContacts,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onSelect,
  onClear,
}: ExternalReferrerPickerProps) {
  if (selectedContact) {
    return (
      <div className='bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2'>
        <LinkIcon className='text-muted-foreground h-4 w-4 shrink-0' />
        <div className='flex min-w-0 flex-1 flex-col text-sm leading-tight'>
          {selectedContact.name ? (
            <>
              <span className='truncate font-medium'>
                {selectedContact.name}
              </span>
              <span className='text-muted-foreground truncate text-xs'>
                {selectedContact.email}
              </span>
            </>
          ) : (
            <span className='truncate font-medium'>
              {selectedContact.email}
            </span>
          )}
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
            aria-label={`Clear external referrer ${selectedContact.name ?? selectedContact.email}`}
          >
            <X className='h-4 w-4' />
          </Button>
        </DisabledFieldTooltip>
      </div>
    )
  }

  const hasNoContacts = availableContacts.length === 0

  return (
    <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange} modal>
      <DisabledFieldTooltip
        disabled={disabled || hasNoContacts}
        reason={
          disabledReason ?? (hasNoContacts ? 'No contacts available' : null)
        }
      >
        <div className='w-full'>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-between'
              disabled={disabled || hasNoContacts}
            >
              <span className='flex items-center gap-2'>
                <LinkIcon className='h-4 w-4' />
                Select external referrer
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
          <CommandInput placeholder='Search contacts...' />
          <CommandEmpty>No matching contacts.</CommandEmpty>
          <CommandList>
            <CommandGroup heading='Contacts'>
              {availableContacts.map(contact => (
                <CommandItem
                  key={contact.id}
                  value={`${contact.name ?? ''} ${contact.email}`}
                  onSelect={() => {
                    if (isPending) return
                    onSelect(contact)
                  }}
                >
                  <div className='flex flex-col'>
                    {contact.name ? (
                      <>
                        <span className='font-medium'>{contact.name}</span>
                        <span className='text-muted-foreground text-xs'>
                          {contact.email}
                        </span>
                      </>
                    ) : (
                      <span className='font-medium'>{contact.email}</span>
                    )}
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
