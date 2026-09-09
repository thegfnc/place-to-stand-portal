'use client'

import { Building2 } from 'lucide-react'

import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import type { LinkedClient } from '@/lib/queries/contacts'

type LinkedClientsCellProps = {
  clients: LinkedClient[]
}

export function LinkedClientsCell({ clients }: LinkedClientsCellProps) {
  return (
    <span className='flex items-center gap-2 text-sm' title='Clients'>
      <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
      <LinkedRecordsHoverCell
        count={clients.length}
        icon={Building2}
        contentClassName='w-56'
        items={clients.map(client => ({
          id: client.id,
          label: client.name,
          href: `/clients/${client.slug}`,
        }))}
      />
    </span>
  )
}
