'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import type { ClientWithMetrics } from '@/lib/data/clients'

type ClientsLandingHeaderProps = {
  clients: ClientWithMetrics[]
  selectedClientId?: string | null
}

export function ClientsLandingHeader({
  clients,
  selectedClientId = null,
}: ClientsLandingHeaderProps) {
  const router = useRouter()

  const clientItems = useMemo(() => {
    return clients.map(client => ({
      value: client.id,
      label: client.name,
      keywords: [client.name, client.slug ?? ''].filter(Boolean),
    }))
  }, [clients])

  const selectedIndex = useMemo(() => {
    if (!selectedClientId) return -1
    return clients.findIndex(c => c.id === selectedClientId)
  }, [clients, selectedClientId])

  const canSelectPrevious = selectedIndex > 0
  const canSelectNext =
    selectedIndex >= 0 && selectedIndex < clients.length - 1

  const handleClientSelect = (clientId: string | null) => {
    if (!clientId) {
      router.push('/clients')
      return
    }

    const client = clients.find(c => c.id === clientId)
    if (client) {
      const path = client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
      router.push(path)
    }
  }

  const handleSelectPrevious = () => {
    if (!canSelectPrevious) return
    const prevClient = clients[selectedIndex - 1]
    handleClientSelect(prevClient.id)
  }

  const handleSelectNext = () => {
    if (!canSelectNext) return
    const nextClient = clients[selectedIndex + 1]
    handleClientSelect(nextClient.id)
  }

  return (
    <div className='flex w-full flex-wrap items-center gap-3'>
      <div className='flex flex-1 items-center gap-3 py-2.5'>
        <div className='min-w-[400px] space-y-2'>
          <Label htmlFor='clients-client-select' className='sr-only'>
            Client Selector
          </Label>
          <SearchableCombobox
            id='clients-client-select'
            items={clientItems}
            value={selectedClientId ?? ''}
            onChange={value => handleClientSelect(value || null)}
            placeholder='Select a client'
            searchPlaceholder='Search clients...'
            disabled={clientItems.length === 0}
            ariaLabel='Select client'
          />
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={handleSelectPrevious}
            disabled={!canSelectPrevious}
            aria-label='Select previous client'
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={handleSelectNext}
            disabled={!canSelectNext}
            aria-label='Select next client'
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}

