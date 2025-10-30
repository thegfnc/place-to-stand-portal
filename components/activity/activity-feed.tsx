'use client'

import { useMemo } from 'react'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  ActivityLogWithActor,
  ActivityTargetType,
} from '@/lib/activity/types'

type ActivityApiResponse = {
  logs: ActivityLogWithActor[]
  hasMore: boolean
  nextCursor: string | null
}

export type ActivityFeedProps = {
  targetType:
    | ActivityTargetType
    | string
    | ReadonlyArray<ActivityTargetType | string>
  targetId?: string | null
  projectId?: string | null
  clientId?: string | null
  pageSize?: number
  className?: string
  emptyState?: React.ReactNode
  requireContext?: boolean
}

type HighlightDetail = {
  field: string
  before: string
  after: string
}

type HighlightFact = {
  label: string
  value: string
}

export function ActivityFeed({
  targetType,
  targetId,
  projectId,
  clientId,
  pageSize = 20,
  className,
  emptyState,
  requireContext,
}: ActivityFeedProps) {
  const requiresContext = requireContext ?? true
  const hasContext = Boolean(targetId || projectId || clientId)
  const queryEnabled = requiresContext
    ? Boolean(targetType && hasContext)
    : Boolean(targetType)
  const normalizedTargetTypes = useMemo(() => {
    if (!targetType) {
      return [] as string[]
    }

    const values = Array.isArray(targetType)
      ? targetType
      : ([targetType] as Array<ActivityTargetType | string>)

    return [...values]
      .map(value => String(value))
      .filter(value => value.length > 0)
      .sort()
  }, [targetType])
  const targetTypeKey = normalizedTargetTypes.join(',')
  const queryKey = useMemo(
    () =>
      [
        'activity-feed',
        targetTypeKey,
        targetId ?? null,
        projectId ?? null,
        clientId ?? null,
        pageSize,
        requiresContext,
      ] as const,
    [targetTypeKey, targetId, projectId, clientId, pageSize, requiresContext]
  )

  const activityQuery = useInfiniteQuery<
    ActivityApiResponse,
    Error,
    ActivityApiResponse,
    typeof queryKey,
    string | null
  >({
    queryKey,
    enabled: queryEnabled,
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    queryFn: async ({ pageParam }) => {
      if (!queryEnabled || normalizedTargetTypes.length === 0) {
        return { logs: [], hasMore: false, nextCursor: null }
      }

      const params = new URLSearchParams()
      normalizedTargetTypes.forEach(type => {
        params.append('targetType', type)
      })

      if (targetId) {
        params.set('targetId', targetId)
      }

      if (projectId) {
        params.set('projectId', projectId)
      }

      if (clientId) {
        params.set('clientId', clientId)
      }

      params.set('limit', pageSize.toString())

      if (pageParam) {
        params.set('cursor', pageParam)
      }

      const response = await fetch(`/api/activity?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to load activity.')
      }

      return (await response.json()) as ActivityApiResponse
    },
  })

  const logs: ActivityLogWithActor[] = useMemo(() => {
    const infiniteData = activityQuery.data as
      | InfiniteData<ActivityApiResponse, string | null>
      | undefined

    if (!infiniteData) {
      return []
    }

    return infiniteData.pages.flatMap((page: ActivityApiResponse) => page.logs)
  }, [activityQuery.data])

  if (!queryEnabled && requiresContext) {
    return (
      <div className={cn('text-muted-foreground text-sm', className)}>
        Activity will appear once this record is saved.
      </div>
    )
  }

  if (activityQuery.isLoading) {
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

  if (activityQuery.isError) {
    return (
      <div className={cn('space-y-2 text-sm', className)}>
        <p className='text-destructive'>Unable to load activity.</p>
        <Button
          variant='outline'
          size='sm'
          onClick={() => void activityQuery.refetch()}
        >
          Try again
        </Button>
        {activityQuery.error instanceof Error ? (
          <p className='text-muted-foreground text-xs'>
            {activityQuery.error.message}
          </p>
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
      {activityQuery.hasNextPage ? (
        <div className='flex justify-center'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void activityQuery.fetchNextPage()}
            disabled={activityQuery.isFetchingNextPage}
          >
            {activityQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type ActivityFeedItemProps = {
  log: ActivityLogWithActor
}

function ActivityFeedItem({ log }: ActivityFeedItemProps) {
  const actorName = getActorDisplayName(log)
  const actorInitials = getActorInitials(actorName)
  const createdAtLabel = formatDistanceToNow(new Date(log.created_at), {
    addSuffix: true,
  })

  const metadata = toRecord(log.metadata)
  const changedFields = getChangedFields(metadata)
  const detailHighlights = getDetailHighlights(metadata)
  const factHighlights = getFactHighlights(metadata)

  return (
    <div className='flex items-start gap-3'>
      <Avatar className='h-9 w-9'>
        {log.actor?.avatar_url ? (
          <AvatarImage src={log.actor.avatar_url} alt={actorName} />
        ) : null}
        <AvatarFallback>{actorInitials}</AvatarFallback>
      </Avatar>
      <div className='flex-1 space-y-2'>
        <div className='space-y-1'>
          <div className='text-sm font-medium'>{actorName}</div>
          <div className='text-sm'>{log.summary}</div>
          <div className='text-muted-foreground text-xs'>{createdAtLabel}</div>
        </div>
        {changedFields.length > 0 ? (
          <div className='flex flex-wrap gap-1'>
            {changedFields.map(field => (
              <Badge key={field} variant='secondary' className='text-xs'>
                {field}
              </Badge>
            ))}
          </div>
        ) : null}
        {detailHighlights.length > 0 ? (
          <div className='space-y-1 text-xs'>
            {detailHighlights.map(detail => (
              <div key={detail.field} className='text-muted-foreground'>
                <span className='text-foreground font-medium'>
                  {detail.field}:
                </span>{' '}
                <span>{detail.before}</span>{' '}
                <span className='text-foreground'>→</span>{' '}
                <span>{detail.after}</span>
              </div>
            ))}
          </div>
        ) : null}
        {factHighlights.length > 0 ? (
          <ul className='text-muted-foreground space-y-1 text-xs'>
            {factHighlights.map(fact => (
              <li key={`${fact.label}:${fact.value}`}>
                <span className='text-foreground font-medium'>
                  {fact.label}:
                </span>{' '}
                <span>{fact.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

function getActorDisplayName(log: ActivityLogWithActor): string {
  return (
    log.actor?.full_name ||
    log.actor?.email ||
    (log.actor_role ? `${log.actor_role.toLowerCase()} user` : 'System')
  )
}

function getActorInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)

  if (!parts.length) {
    return '?'
  }

  return parts
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function getChangedFields(metadata: Record<string, unknown> | null): string[] {
  if (!metadata) {
    return []
  }

  const fields = metadata.changedFields

  if (!Array.isArray(fields)) {
    return []
  }

  return fields
    .map(field => (typeof field === 'string' ? field : null))
    .filter((field): field is string => Boolean(field))
}

function getDetailHighlights(
  metadata: Record<string, unknown> | null
): HighlightDetail[] {
  if (!metadata) {
    return []
  }

  const detailsRecord = toRecord(metadata.details)

  if (!detailsRecord) {
    return []
  }

  const before = toRecord(detailsRecord['before'])
  const after = toRecord(detailsRecord['after'])

  if (!before && !after) {
    return []
  }

  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])

  return Array.from(fields).map(field => ({
    field,
    before: formatDetailValue(before ? before[field] : undefined),
    after: formatDetailValue(after ? after[field] : undefined),
  }))
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (Array.isArray(value)) {
    return value
      .map(item => formatDetailValue(item))
      .filter(Boolean)
      .join(', ')
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

function getFactHighlights(
  metadata: Record<string, unknown> | null
): HighlightFact[] {
  if (!metadata) {
    return []
  }

  const facts: HighlightFact[] = []

  const email = metadata.email
  if (typeof email === 'string' && email.trim()) {
    facts.push({ label: 'Email', value: email })
  }

  const role = metadata.role
  if (typeof role === 'string' && role.trim()) {
    facts.push({ label: 'Role', value: role })
  }

  const hours = metadata.hours
  if (typeof hours === 'number' && Number.isFinite(hours)) {
    facts.push({
      label: 'Hours',
      value: hours.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    })
  }

  const linkedTaskCount = metadata.linkedTaskCount
  if (typeof linkedTaskCount === 'number' && linkedTaskCount > 0) {
    facts.push({
      label: 'Linked tasks',
      value: linkedTaskCount.toString(),
    })
  }

  const passwordChanged = metadata.passwordChanged
  if (typeof passwordChanged === 'boolean' && passwordChanged) {
    facts.push({ label: 'Password', value: 'Changed' })
  }

  const assigneeRecord = toRecord(metadata.assignees)

  if (assigneeRecord) {
    const added = Array.isArray(assigneeRecord.added)
      ? (assigneeRecord.added as unknown[]).length
      : 0
    const removed = Array.isArray(assigneeRecord.removed)
      ? (assigneeRecord.removed as unknown[]).length
      : 0

    if (added > 0 || removed > 0) {
      const parts: string[] = []

      if (added > 0) {
        parts.push(`+${added}`)
      }

      if (removed > 0) {
        parts.push(`-${removed}`)
      }

      facts.push({ label: 'Assignees', value: parts.join(' / ') })
    }
  }

  return facts
}
