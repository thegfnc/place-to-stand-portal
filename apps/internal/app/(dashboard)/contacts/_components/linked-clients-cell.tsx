'use client'

import { Building2 } from 'lucide-react'

import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import type { LinkedClient } from '@/lib/queries/contacts'

type LinkedClientsCellProps = {
  clients: LinkedClient[]
}

export function LinkedClientsCell({ clients }: LinkedClientsCellProps) {
  return (
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
  )
}
