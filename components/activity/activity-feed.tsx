'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ActivityFeedItem } from '@/components/activity/activity-feed-item'
import {
  useActivityFeed,
  type UseActivityFeedOptions,
} from '@/lib/activity/use-activity-feed'
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
    <div className={cn('space-y-4', className)}>
      <ul className='space-y-4'>
        {logs.map(log => (
          <li key={log.id} className='rounded-lg border p-4'>
            <ActivityFeedItem log={log} />
          </li>
        ))}
      </ul>
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
