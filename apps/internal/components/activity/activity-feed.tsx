'use client'

import { useMemo, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ActivityFeedItem } from '@/components/activity/activity-feed-item'
import type { ActivityLogWithActor } from '@/lib/activity/types'
import {
  useActivityFeed,
  type UseActivityFeedOptions,
} from '@/lib/activity/use-activity-feed'
import { formatCalendarDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

export type ActivityFeedProps = UseActivityFeedOptions & {
  className?: string
  emptyState?: ReactNode
}

export function ActivityFeed({
  className,
  emptyState,
  ...queryOptions
}: ActivityFeedProps) {
  const {
    logs,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    queryEnabled,
    requiresContext,
  } = useActivityFeed(queryOptions)

  const groups = useMemo(() => groupByDay(logs), [logs])

  if (!queryEnabled && requiresContext) {
    return (
      <div className={cn('text-muted-foreground text-sm', className)}>
        Activity will appear once this record is saved.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex items-center gap-2 text-sm',
          className
        )}
      >
        <Loader2 className='h-4 w-4 animate-spin' /> Loading activity…
      </div>
    )
  }

  if (isError) {
    return (
      <div className={cn('space-y-2 text-sm', className)}>
        <p className='text-destructive'>Unable to load activity.</p>
        <Button variant='outline' size='sm' onClick={() => void refetch()}>
          Try again
        </Button>
        {error ? (
          <p className='text-muted-foreground text-xs'>{error.message}</p>
        ) : null}
      </div>
    )
  }

  if (!logs.length) {
    return (
      <div className={cn('text-muted-foreground text-sm', className)}>
        {emptyState ?? 'No activity recorded yet.'}
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groups.map(group => (
        <section key={group.key} aria-label={group.label}>
          <h4 className='text-muted-foreground mb-3 text-[11px] font-semibold tracking-wide uppercase'>
            {group.label}
          </h4>
          {/* The rail is drawn once per day group and sits behind each item's icon node. */}
          <ol className='before:bg-border relative space-y-5 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-px'>
            {group.logs.map(log => (
              <li key={log.id} className='relative'>
                <ActivityFeedItem log={log} />
              </li>
            ))}
          </ol>
        </section>
      ))}
      {hasNextPage ? (
        <div className='flex justify-center'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type DayGroup = {
  key: string
  label: string
  logs: ActivityLogWithActor[]
}

const DAY_KEY_STYLE = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
} as const

function groupByDay(logs: ActivityLogWithActor[]): DayGroup[] {
  const now = new Date()
  const todayKey = formatCalendarDate(now, DAY_KEY_STYLE)
  const yesterdayKey = formatCalendarDate(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
    DAY_KEY_STYLE
  )
  const currentYear = formatCalendarDate(now, { year: 'numeric' })

  const groups: DayGroup[] = []

  for (const log of logs) {
    const key = formatCalendarDate(log.created_at, DAY_KEY_STYLE) ?? 'unknown'
    const last = groups[groups.length - 1]

    if (last && last.key === key) {
      last.logs.push(log)
      continue
    }

    groups.push({ key, label: labelForDay(log.created_at, key), logs: [log] })
  }

  return groups

  function labelForDay(value: string, key: string): string {
    if (key === todayKey) return 'Today'
    if (key === yesterdayKey) return 'Yesterday'

    const sameYear = formatCalendarDate(value, { year: 'numeric' }) === currentYear

    return (
      formatCalendarDate(value, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
      }) ?? 'Earlier'
    )
  }
}
