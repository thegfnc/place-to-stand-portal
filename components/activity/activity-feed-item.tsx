import { formatDistanceToNow } from 'date-fns'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { ActivityLogWithActor } from '@/lib/activity/types'
import {
  getActorDisplayName,
  getActorInitials,
  getChangedFields,
  getDetailHighlights,
  getFactHighlights,
  toRecord,
  type HighlightDetail,
  type HighlightFact,
} from '@/lib/activity/feed-highlights'

export type ActivityFeedItemProps = {
  log: ActivityLogWithActor
}

export function ActivityFeedItem({ log }: ActivityFeedItemProps) {
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
        <header className='space-y-1'>
          <div className='text-sm font-medium'>{actorName}</div>
          <div className='text-sm'>{log.summary}</div>
          <time className='text-muted-foreground text-xs'>
            {createdAtLabel}
          </time>
        </header>
        <ChangedFieldBadges fields={changedFields} />
        <DetailHighlightList highlights={detailHighlights} />
        <FactHighlightList highlights={factHighlights} />
      </div>
    </div>
  )
}

type ChangedFieldBadgesProps = {
  fields: string[]
}

function ChangedFieldBadges({ fields }: ChangedFieldBadgesProps) {
  if (!fields.length) {
    return null
  }

  return (
    <div className='flex flex-wrap gap-1'>
      {fields.map(field => (
        <Badge key={field} variant='secondary' className='text-xs'>
          {field}
        </Badge>
      ))}
    </div>
  )
}

type DetailHighlightListProps = {
  highlights: HighlightDetail[]
}

function DetailHighlightList({ highlights }: DetailHighlightListProps) {
  if (!highlights.length) {
    return null
  }

  return (
    <div className='space-y-1 text-xs'>
      {highlights.map(detail => (
        <div key={detail.field} className='text-muted-foreground'>
          <span className='text-foreground font-medium'>{detail.field}:</span>{' '}
          <span>{detail.before}</span>{' '}
          <span className='text-foreground'>→</span> <span>{detail.after}</span>
        </div>
      ))}
    </div>
  )
}

type FactHighlightListProps = {
  highlights: HighlightFact[]
}

function FactHighlightList({ highlights }: FactHighlightListProps) {
  if (!highlights.length) {
    return null
  }

  return (
    <ul className='text-muted-foreground space-y-1 text-xs'>
      {highlights.map(fact => (
        <li key={`${fact.label}:${fact.value}`}>
          <span className='text-foreground font-medium'>{fact.label}:</span>{' '}
          <span>{fact.value}</span>
        </li>
      ))}
    </ul>
  )
}
