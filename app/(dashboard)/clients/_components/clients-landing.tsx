'use client'

import Link from 'next/link'
import { Building2, Clock, FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ClientWithMetrics } from '@/lib/data/clients'
import { getBillingTypeLabel } from '@/lib/settings/clients/billing-types'
import { cn } from '@/lib/utils'

type ClientsLandingProps = {
  clients: ClientWithMetrics[]
}

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(hours: number): string {
  return HOURS_FORMATTER.format(hours)
}

export function ClientsLanding({ clients }: ClientsLandingProps) {
  if (clients.length === 0) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>No clients found</h2>
          <p className='text-muted-foreground text-sm'>
            Clients will appear here once they are created.
          </p>
        </div>
      </div>
    )
  }

  const getClientHref = (client: ClientWithMetrics) => {
    return client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
  }

  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead className='w-[300px]'>Client</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead>Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => (
            <TableRow key={client.id}>
              <TableCell>
                <Link
                  href={getClientHref(client)}
                  className='flex items-center gap-2 py-1 hover:underline'
                >
                  <Building2 className='h-4 w-4 shrink-0 text-blue-500' />
                  <span className='font-medium'>{client.name}</span>
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant='outline' className='text-xs'>
                  {getBillingTypeLabel(client.billingType)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className='flex items-center gap-2 text-sm'>
                  <FolderKanban className='text-muted-foreground h-4 w-4' />
                  <span className='text-muted-foreground'>
                    {client.activeProjectCount} active
                    {client.projectCount > client.activeProjectCount && (
                      <span className='text-muted-foreground/60'>
                        {' '}
                        ({client.projectCount} total)
                      </span>
                    )}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {client.billingType === 'prepaid' ? (
                  <div className='flex items-center gap-2 text-sm'>
                    <Clock
                      className={cn(
                        'h-4 w-4',
                        client.hoursRemaining > 0
                          ? 'text-emerald-600'
                          : client.hoursRemaining === 0
                            ? 'text-muted-foreground'
                            : 'text-red-600'
                      )}
                    />
                    <span
                      className={cn(
                        client.hoursRemaining > 0
                          ? 'font-medium text-emerald-600'
                          : client.hoursRemaining === 0
                            ? 'text-muted-foreground'
                            : 'font-medium text-red-600'
                      )}
                    >
                      {formatHours(client.hoursRemaining)} remaining
                    </span>
                    <span className='text-muted-foreground/60'>
                      ({formatHours(client.totalHoursPurchased)} total)
                    </span>
                  </div>
                ) : (
                  <span className='text-muted-foreground text-sm'>—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
