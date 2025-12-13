'use client'

import Link from 'next/link'
import { Building2, Clock, FolderKanban } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import type { RecentlyViewedSummary } from '@/lib/dashboard/types'

export type RecentlyViewedWidgetProps = {
  projects: RecentlyViewedSummary[]
  clients: RecentlyViewedSummary[]
  className?: string
}

export function RecentlyViewedWidget({
  projects,
  clients,
  className,
}: RecentlyViewedWidgetProps) {
  return (
    <section
      className={cn(
        'bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='recently-viewed-heading'
    >
      <header className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4'>
        <div>
          <h2 id='recently-viewed-heading' className='text-base font-semibold'>
            Recently Viewed
          </h2>
          <p className='text-muted-foreground text-xs'>
            Quick links back to the projects and clients you opened most
            recently.
          </p>
        </div>
      </header>
      <div className='grid flex-1 px-5 py-4 sm:grid-cols-2'>
        <EntityList
          title='Projects'
          items={projects}
          emptyHint='View any project to pin it here.'
          icon={FolderKanban}
        />
        <EntityList
          title='Clients'
          items={clients}
          emptyHint='Visit a client profile to populate this list.'
          icon={Building2}
        />
      </div>
    </section>
  )
}

type EntityListProps = {
  title: string
  items: RecentlyViewedSummary[]
  emptyHint: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

function EntityList({ title, items, emptyHint, icon: Icon }: EntityListProps) {
  return (
    <div className='flex flex-col gap-2 first:pr-4 last:pl-4'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-muted-foreground ml-1 text-xs font-normal uppercase'>
          {title}
        </p>
      </div>
      {items.length === 0 ? (
        <p className='text-muted-foreground text-xs'>{emptyHint}</p>
      ) : (
        <ul className='space-y-1'>
          {items.map(item => (
            <li key={`${title}-${item.id}`}>
              <Link
                href={item.href}
                className='group border-muted hover:bg-muted/50 flex gap-2 rounded-lg px-2 py-2 transition'
              >
                <Icon
                  className='text-muted-foreground group-hover:text-foreground mb-1 h-4 w-4 transition'
                  aria-hidden
                />
                <div className='space-y-0.5'>
                  <p className='text-xs leading-tight font-medium'>
                    {item.name}
                  </p>
                  <div className='text-muted-foreground/80 flex items-center gap-2 text-xs'>
                    {item.contextLabel ? (
                      <span>{item.contextLabel}</span>
                    ) : null}
                    <TimeAgo timestamp={item.touchedAt} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type TimeAgoProps = {
  timestamp: string
}

function TimeAgo({ timestamp }: TimeAgoProps) {
  if (!timestamp) {
    return null
  }

  const label = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  })

  return (
    <span className='text-muted-foreground/50 inline-flex items-center gap-1'>
      <Clock className='h-3.5 w-3.5' aria-hidden />
      {label}
    </span>
  )
}
