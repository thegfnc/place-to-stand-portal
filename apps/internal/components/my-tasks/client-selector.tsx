'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import type { ProjectTypeValue } from '@/lib/types'
import {
  HIDE_PARAM,
  HIDEABLE_PROJECT_TYPES,
  describeHiddenProjectTypes,
  serializeHiddenProjectTypes,
  type HideableProjectType,
} from '@/lib/my-tasks/project-scope'
import { cn } from '@/lib/utils'

import { ClientScopeRow } from './client-scope-row'

const ALL_CLIENTS_VALUE = 'all'
const ALL_CLIENTS_LABEL = 'All clients'

const SCOPE_ROWS: { type: HideableProjectType; label: string }[] = [
  { type: HIDEABLE_PROJECT_TYPES.personal, label: 'Personal projects' },
  { type: HIDEABLE_PROJECT_TYPES.internal, label: 'Internal projects' },
]

// cmdk sets data-selected on pointer move, but Base UI-era items pair it with
// an explicit hover: class so plain mouse hover always lights the row.
const ITEM_HOVER_CLASSES = 'hover:bg-accent hover:text-accent-foreground'

export type ClientSelectorOption = {
  id: string
  name: string
}

type ClientSelectorProps = {
  clients: ClientSelectorOption[]
  /** A client id, or `'all'` (the default — no client filter). */
  selectedClientId: string
  /** Project types withheld from the board; empty = show everything. */
  hiddenProjectTypes: ProjectTypeValue[]
  disabled?: boolean
}

/**
 * Client + project-type scope for the My Tasks board — the person selector's
 * sibling, for walking one client at a time in weekly planning.
 *
 * State lives in two params next to `?assignee=`: `?clientId=` (NOT
 * `?client=`, which is the client sheet's deep-link param and would open the
 * edit sheet on every dashboard route) and `?hide=personal,internal`. The
 * "Show" checkboxes only matter under "All clients": PERSONAL and INTERNAL
 * projects have no client, so a client selection already excludes them.
 */
export function ClientSelector({
  clients,
  selectedClientId,
  hiddenProjectTypes,
  disabled = false,
}: ClientSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  )

  const isAllClients = selectedClientId === ALL_CLIENTS_VALUE
  const selectedLabel = isAllClients
    ? ALL_CLIENTS_LABEL
    : (clients.find(client => client.id === selectedClientId)?.name ??
      ALL_CLIENTS_LABEL)
  // The hint reflects what the board is actually withholding. Under a single
  // client the type scope is implied, so it stays quiet there.
  const hiddenHint = isAllClients
    ? describeHiddenProjectTypes(hiddenProjectTypes)
    : ''

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      // Unrelated params (sheet stack, assignee) ride along untouched.
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const search = params.toString()
      router.push(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  const handleSelectClient = useCallback(
    (clientId: string) => {
      setOpen(false)
      pushParams(params => {
        if (clientId !== ALL_CLIENTS_VALUE) {
          params.set('clientId', clientId)
        } else {
          params.delete('clientId')
        }
      })
    },
    [pushParams]
  )

  const handleToggleType = useCallback(
    (type: HideableProjectType) => {
      const next = hiddenProjectTypes.includes(type)
        ? hiddenProjectTypes.filter(hidden => hidden !== type)
        : [...hiddenProjectTypes, type]
      const serialized = serializeHiddenProjectTypes(next)
      pushParams(params => {
        if (serialized) {
          params.set(HIDE_PARAM, serialized)
        } else {
          params.delete(HIDE_PARAM)
        }
      })
    },
    [hiddenProjectTypes, pushParams]
  )

  return (
    // Same invisible-sizer trick as PersonSelector: the trigger holds the
    // widest label's width (including the longest hint) so switching scope
    // never shifts the toolbar.
    <div className='grid'>
      <div
        aria-hidden='true'
        className='pointer-events-none invisible col-start-1 row-start-1 overflow-hidden'
      >
        {[
          `${ALL_CLIENTS_LABEL} · ${describeHiddenProjectTypes(
            SCOPE_ROWS.map(row => row.type)
          )}`,
          ...sortedClients.map(client => client.name),
        ].map(label => (
          <span
            key={label}
            className='flex h-0 items-center gap-2 border-x border-x-transparent px-3 text-sm whitespace-nowrap'
          >
            <span className='size-4 shrink-0' />
            {label}
            <span className='size-4 shrink-0' />
          </span>
        ))}
      </div>
      <div className='col-start-1 row-start-1'>
        <Popover open={open} onOpenChange={setOpen} modal>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              role='combobox'
              aria-expanded={open}
              aria-haspopup='listbox'
              aria-label='Client scope'
              disabled={disabled}
              className='h-8 w-full justify-between px-3 py-0 text-sm font-normal'
            >
              <span className='flex min-w-0 items-center gap-2'>
                <Building2 className='text-muted-foreground size-4 shrink-0' />
                <span className='truncate font-medium'>{selectedLabel}</span>
                {hiddenHint ? (
                  <span className='text-muted-foreground shrink-0 text-xs'>
                    · {hiddenHint}
                  </span>
                ) : null}
              </span>
              <ChevronsUpDown className='size-4 shrink-0 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className='w-(--radix-popover-trigger-width) min-w-64 p-0'
            sideOffset={8}
          >
            <Command>
              <CommandInput placeholder='Search clients...' className='h-9' />
              <CommandList className='max-h-[min(60vh,320px)] overflow-y-auto overscroll-contain'>
                <CommandEmpty>No clients found.</CommandEmpty>
                <CommandGroup heading='Show'>
                  {SCOPE_ROWS.map(row => (
                    <ClientScopeRow
                      key={row.type}
                      label={row.label}
                      checked={!hiddenProjectTypes.includes(row.type)}
                      disabled={!isAllClients}
                      onToggle={() => handleToggleType(row.type)}
                      className={ITEM_HOVER_CLASSES}
                    />
                  ))}
                  {!isAllClients ? (
                    <p className='text-muted-foreground px-2 pt-1 pb-1.5 text-xs'>
                      Applies under All clients.
                    </p>
                  ) : null}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading='Client'>
                  <CommandItem
                    value={ALL_CLIENTS_LABEL}
                    keywords={['all', 'clients']}
                    onSelect={() => handleSelectClient(ALL_CLIENTS_VALUE)}
                    className={cn('whitespace-nowrap', ITEM_HOVER_CLASSES)}
                  >
                    <Building2 />
                    {ALL_CLIENTS_LABEL}
                    {isAllClients ? <Check className='ml-auto' /> : null}
                  </CommandItem>
                  {sortedClients.map(client => (
                    <CommandItem
                      key={client.id}
                      // Label + id: two clients with the same name stay
                      // distinct rows for cmdk without changing the search.
                      value={`${client.name} ${client.id}`}
                      keywords={['client']}
                      onSelect={() => handleSelectClient(client.id)}
                      className={cn('whitespace-nowrap', ITEM_HOVER_CLASSES)}
                    >
                      <Building2 />
                      <span className='truncate'>{client.name}</span>
                      {selectedClientId === client.id ? (
                        <Check className='ml-auto' />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
