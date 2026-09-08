'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { Building2 } from 'lucide-react'

import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

const ALL_CLIENTS_VALUE = 'all'

export type ClientSelectorOption = {
  id: string
  name: string
}

type ClientSelectorProps = {
  clients: ClientSelectorOption[]
  /** A client id, or `'all'` (the default — no client filter). */
  selectedClientId: string
  disabled?: boolean
}

/**
 * Client filter for the My Tasks board — the person selector's sibling, for
 * walking one client at a time in weekly planning. State lives in the
 * `?clientId=` param next to `?assignee=` — NOT `?client=`, which is the
 * client sheet's deep-link param and would open the edit sheet (SheetHost
 * claims it on every dashboard route). "All clients" clears it.
 */
export function ClientSelector({
  clients,
  selectedClientId,
  disabled = false,
}: ClientSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items: SearchableComboboxItem[] = useMemo(
    () => [
      {
        value: ALL_CLIENTS_VALUE,
        label: 'All clients',
        keywords: ['all', 'clients'],
        icon: Building2,
      },
      ...clients
        .map(client => ({
          value: client.id,
          label: client.name,
          keywords: ['client'],
          icon: Building2,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [clients]
  )

  const handleChange = useCallback(
    (clientId: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (clientId && clientId !== ALL_CLIENTS_VALUE) {
        params.set('clientId', clientId)
      } else {
        params.delete('clientId')
      }

      const search = params.toString()
      const url = search ? `${pathname}?${search}` : pathname

      router.push(url, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    // Same invisible-sizer trick as PersonSelector: the trigger holds the
    // widest option's width so switching clients never shifts the toolbar.
    <div className='grid'>
      <div
        aria-hidden='true'
        className='pointer-events-none invisible col-start-1 row-start-1 overflow-hidden'
      >
        {items.map(item => (
          <span
            key={item.value}
            className='flex h-0 items-center gap-2 border-x border-x-transparent px-3 text-sm whitespace-nowrap'
          >
            <span className='size-5 shrink-0' />
            {item.label}
            <span className='size-4 shrink-0' />
          </span>
        ))}
      </div>
      <div className='col-start-1 row-start-1'>
        <SearchableCombobox
          items={items}
          value={selectedClientId}
          onChange={handleChange}
          placeholder='Select client'
          searchPlaceholder='Search clients...'
          emptyMessage='No clients found.'
          disabled={disabled}
          className='w-full'
          triggerClassName='h-8 py-0 text-sm'
          itemClassName='whitespace-nowrap'
        />
      </div>
    </div>
  )
}
