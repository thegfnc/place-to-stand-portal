import { useMemo } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ActivityChangeList } from '@/components/activity/activity-change-list'
import { getActivityChanges, type ActivityFact } from '@/lib/activity/changes'
import {
  getActorDisplayName,
  getActorInitials,
} from '@/lib/activity/feed-highlights'
import type { ActivityLogWithActor } from '@/lib/activity/types'
import {
  getToneClasses,
  getVerbPresentation,
} from '@/lib/activity/verb-presentation'
import { formatHours } from '@/lib/activity/events/shared'
import { formatCalendarDate } from '@/lib/dates'
import type { ActivitySourceValue } from '@/lib/types'
import { cn } from '@/lib/utils'

export type ActivityFeedItemProps = {
  log: ActivityLogWithActor
}

/**
 * Admin UI is the default source and carries no signal, so only CLI and
 * System actions get a badge.
 */
const SOURCE_BADGES: Partial<Record<ActivitySourceValue, { label: string; className: string }>> = {
  CLI: {
    label: 'CLI',
    className:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
  },
  SYSTEM: {
    label: 'System',
    className:
      'bg-slate-700 text-slate-50 border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800',
  },
}

const TIMESTAMP_STYLE = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function ActivityFeedItem({ log }: ActivityFeedItemProps) {
  const actorName = getActorDisplayName(log)
  const actorInitials = getActorInitials(actorName)
  const changes = useMemo(() => getActivityChanges(log), [log])
  const hasChanges =
    changes.fields.length > 0 || changes.memberships.length > 0
  const summary = hasChanges ? stripTrailingFieldList(log.summary) : log.summary

  const { icon: Icon, tone } = getVerbPresentation(log.verb)
  const sourceBadge = SOURCE_BADGES[log.source]
  const createdAt = new Date(log.created_at)
  const relativeLabel = formatDistanceToNowStrict(createdAt, {
    addSuffix: true,
  })
  const absoluteLabel = formatCalendarDate(log.created_at, TIMESTAMP_STYLE)

  return (
    <article className='flex items-start gap-3'>
      <span
        aria-hidden='true'
        className={cn(
          'ring-background relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4',
          getToneClasses(tone)
        )}
      >
        <Icon className='h-3.5 w-3.5' />
      </span>

      <div className='min-w-0 flex-1 pt-0.5'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug'>
          <span className='inline-flex items-center gap-1.5 font-medium'>
            <Avatar className='h-5 w-5'>
              {log.actor?.avatar_url ? (
                <AvatarImage
                  src={`/api/storage/user-avatar/${log.actor.id}`}
                  alt=''
                />
              ) : null}
              <AvatarFallback className='text-[9px]'>
                {actorInitials}
              </AvatarFallback>
            </Avatar>
            {actorName}
          </span>
          <span className='text-foreground/90 min-w-0'>{summary}</span>
          {sourceBadge ? (
            <Badge
              variant='outline'
              className={cn('h-5 px-1.5 text-[10px]', sourceBadge.className)}
            >
              {sourceBadge.label}
            </Badge>
          ) : null}
          <time
            dateTime={log.created_at}
            title={absoluteLabel ?? undefined}
            className='text-muted-foreground text-xs whitespace-nowrap'
          >
            {relativeLabel}
          </time>
        </div>

        {hasChanges ? (
          <ActivityChangeList
            fields={changes.fields}
            memberships={changes.memberships}
            targetType={log.target_type}
            references={log.references}
          />
        ) : null}

        <FactChips facts={changes.facts} />
      </div>
    </article>
  )
}

/**
 * Writers append "(title, due date, and assignees)" to update summaries for
 * the benefit of plain-text consumers. When the feed renders the change rows
 * themselves, that suffix is pure repetition.
 */
function stripTrailingFieldList(summary: string): string {
  return summary.replace(/\s\([^()]*\)\s*$/, '')
}

function FactChips({ facts }: { facts: ActivityFact[] }) {
  if (!facts.length) return null

  return (
    <ul className='text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs'>
      {facts.map(fact => (
        <li key={`${fact.label}:${fact.value}`} className='inline-flex gap-1'>
          <span>{fact.label}</span>
          <span
            className={cn(
              'text-foreground',
              fact.kind === 'mono' && 'font-mono text-[11px]'
            )}
          >
            {formatFact(fact)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function formatFact(fact: ActivityFact): string {
  switch (fact.kind) {
    case 'money': {
      const amount = Number(fact.value)
      return Number.isFinite(amount) ? MONEY.format(amount) : fact.value
    }
    case 'hours': {
      const hours = Number(fact.value)
      return Number.isFinite(hours) ? `${formatHours(hours)}h` : fact.value
    }
    case 'date':
      return formatCalendarDate(fact.value) ?? fact.value
    default:
      return fact.value
  }
}

