'use client'

import Link from 'next/link'
import { Building2, FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { ClientWithMetrics } from '@/lib/data/clients'
import { getBillingTypeLabel } from '@/lib/settings/clients/billing-types'

type ClientsLandingProps = {
  clients: ClientWithMetrics[]
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
    <div className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {clients.map(client => (
          <Link key={client.id} href={getClientHref(client)}>
            <Card className='border-l-4 border-l-blue-500 border-y-border border-r-border hover:border-r-blue-500/50 hover:border-y-blue-500/50 flex h-full cursor-pointer flex-col justify-between shadow-sm transition-all hover:shadow-md'>
              <CardHeader>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex min-w-0 flex-1 items-center gap-2'>
                    <Building2 className='text-blue-500 mt-0.5 h-5 w-5 shrink-0' />
                    <CardTitle className='line-clamp-2'>
                      {client.name}
                    </CardTitle>
                  </div>
                  <Badge variant='outline' className='text-xs'>
                    {getBillingTypeLabel(client.billingType)}
                  </Badge>
                </div>
                {client.slug ? (
                  <CardDescription className='text-muted-foreground text-xs'>
                    /{client.slug}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                <div className='flex items-center gap-2 text-sm'>
                  <FolderKanban className='text-muted-foreground h-4 w-4' />
                  <span className='text-muted-foreground'>
                    {client.activeProjectCount} active project
                    {client.activeProjectCount !== 1 ? 's' : ''}
                  </span>
                  {client.projectCount > client.activeProjectCount ? (
                    <span className='text-muted-foreground/60'>
                      ({client.projectCount} total)
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
