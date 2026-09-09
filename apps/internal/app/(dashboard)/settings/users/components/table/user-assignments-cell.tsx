'use client'

import { Building2 } from 'lucide-react'

import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import type { UserAssignmentSummary } from '@/lib/queries/users/assignments'
import type { UserRoleValue } from '@/lib/types'

type UserAssignmentsCellProps = {
  assignment: UserAssignmentSummary | undefined
  role: UserRoleValue
}

/**
 * Clients a portal user belongs to (`client_members`), with a hover list.
 * Admins never hold memberships, so their cell is a muted dash rather than
 * a misleading zero. Project and task counts in the summary are not shown
 * here — they only feed the archive confirmation sentence.
 */
export function UserAssignmentsCell({
  assignment,
  role,
}: UserAssignmentsCellProps) {
  if (role !== 'CLIENT') {
    return <span className='text-muted-foreground/50'>—</span>
  }

  const clients = assignment?.clientList ?? []

  return (
    <span className='flex items-center gap-1' title='Clients'>
      <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
      <LinkedRecordsHoverCell
        count={clients.length}
        icon={Building2}
        ariaLabel={`${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
        triggerClassName='text-muted-foreground'
        items={clients.map(client => ({
          id: client.id,
          label: client.name,
          href: `/clients/${client.slug ?? client.id}`,
        }))}
      />
    </span>
  )
}
