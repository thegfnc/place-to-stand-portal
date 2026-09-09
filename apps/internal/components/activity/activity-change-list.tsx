import { ArrowRight, Minus, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ActivityRichTextDiff } from '@/components/activity/activity-rich-text-diff'
import {
  humanizeEnum,
  type ActivityFact,
  type FieldChange,
  type MembershipChange,
} from '@/lib/activity/changes'
import { formatFact } from '@/lib/activity/format-fact'
import { formatHours } from '@/lib/activity/events/shared'
import type { ActivityReferences } from '@/lib/activity/types'
import { formatCalendarDate } from '@/lib/dates'
import { getTaskStatusLabel, getTaskStatusToken } from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'

type ActivityChangeListProps = {
  fields: FieldChange[]
  memberships: MembershipChange[]
  facts?: ActivityFact[]
  targetType: string
  references?: ActivityReferences
}

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const LONG_FORM_KINDS = new Set(['richText', 'longText'])

/**
 * One row per changed field: label, previous value, arrow, new value. Long
 * text fields get a collapsible word diff instead of an inline pair, since
 * a description rewrite does not fit on one line.
 */
export function ActivityChangeList({
  fields,
  memberships,
  facts = [],
  targetType,
  references,
}: ActivityChangeListProps) {
  if (!fields.length && !memberships.length && !facts.length) return null

  // Indented to the actor name's text edge (20px avatar + 6px gap) so the
  // block reads as belonging to the line above it. Every row is a 20px line
  // box so labels, values, badges and the diff toggle share one baseline.
  return (
    <dl className='mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 pl-[26px] text-xs leading-5'>
      {fields.map(field => (
        <FieldRow
          key={field.key}
          field={field}
          targetType={targetType}
          references={references}
        />
      ))}
      {facts.map(fact => (
        <div key={`fact:${fact.label}:${fact.value}`} className='contents'>
          <dt className='text-muted-foreground'>{fact.label}</dt>
          <dd
            className={cn(
              'text-foreground min-w-0 font-medium',
              fact.kind === 'mono' && 'font-mono text-[11px]'
            )}
          >
            {formatFact(fact)}
          </dd>
        </div>
      ))}
      {memberships.map(membership => (
        <div key={membership.key} className='contents'>
          <dt className='text-muted-foreground'>{membership.label}</dt>
          <dd className='flex min-w-0 items-center'>
            <MembershipChips
              added={membership.added}
              removed={membership.removed}
              references={membership.kind === 'user' ? references : undefined}
              resolveNames={membership.kind === 'user'}
            />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function FieldRow({
  field,
  targetType,
  references,
}: {
  field: FieldChange
  targetType: string
  references?: ActivityReferences
}) {
  if (LONG_FORM_KINDS.has(field.kind)) {
    return (
      <div className='contents'>
        <dt className='text-muted-foreground self-start'>{field.label}</dt>
        <dd className='min-w-0'>
          <ActivityRichTextDiff
            before={typeof field.before === 'string' ? field.before : null}
            after={typeof field.after === 'string' ? field.after : null}
            isHtml={field.kind === 'richText'}
          />
        </dd>
      </div>
    )
  }

  return (
    <div className='contents'>
      <dt className='text-muted-foreground'>{field.label}</dt>
      <dd className='flex min-w-0 flex-wrap items-center gap-1.5'>
        <ValueChip
          value={field.before}
          field={field}
          targetType={targetType}
          references={references}
          side='before'
        />
        <ArrowRight
          className='text-muted-foreground h-3 w-3 shrink-0'
          aria-label='changed to'
        />
        <ValueChip
          value={field.after}
          field={field}
          targetType={targetType}
          references={references}
          side='after'
        />
      </dd>
    </div>
  )
}

function ValueChip({
  value,
  field,
  targetType,
  references,
  side,
}: {
  value: unknown
  field: FieldChange
  targetType: string
  references?: ActivityReferences
  side: 'before' | 'after'
}) {
  const muted = side === 'before'

  if (field.kind === 'status' && typeof value === 'string') {
    const isTask = targetType === 'TASK'
    return (
      <Badge
        variant='secondary'
        className={cn(
          'h-5 px-1.5 text-[10px]',
          isTask && getTaskStatusToken(value),
          muted && 'opacity-60'
        )}
      >
        {isTask ? getTaskStatusLabel(value) : humanizeEnum(value)}
      </Badge>
    )
  }

  if (field.kind === 'access') {
    const disabled = value === true
    return (
      <span
        className={cn(
          'font-medium',
          disabled
            ? 'text-rose-700 dark:text-rose-300'
            : 'text-emerald-700 dark:text-emerald-300',
          muted && 'opacity-60'
        )}
      >
        {disabled ? 'Disabled' : 'Enabled'}
      </span>
    )
  }

  const text = formatValue(value, field, references)
  const isEmpty = text === null

  return (
    <span
      className={cn(
        'min-w-0 break-words',
        isEmpty && 'text-muted-foreground italic',
        !isEmpty && muted && 'text-muted-foreground line-through decoration-muted-foreground/50',
        !isEmpty && !muted && 'text-foreground font-medium',
        field.key === 'slug' && 'font-mono text-[11px]'
      )}
    >
      {isEmpty ? emptyLabel(field) : text}
    </span>
  )
}

function emptyLabel(field: FieldChange): string {
  switch (field.kind) {
    case 'user':
      return field.key === 'ownerId' ? 'No owner' : 'Unassigned'
    case 'contact':
    case 'project':
    case 'client':
      return 'None'
    case 'date':
      return 'No date'
    default:
      return 'Empty'
  }
}

function formatValue(
  value: unknown,
  field: FieldChange,
  references?: ActivityReferences
): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && !value.trim()) return null

  switch (field.kind) {
    case 'date':
      return typeof value === 'string'
        ? (formatCalendarDate(value) ?? value)
        : String(value)
    case 'enum':
      return typeof value === 'string' ? humanizeEnum(value) : String(value)
    case 'user':
      return typeof value === 'string'
        ? (references?.users[value]?.name ?? 'Unknown user')
        : String(value)
    case 'contact':
      return typeof value === 'string'
        ? (references?.contacts[value] ?? 'Unknown contact')
        : String(value)
    case 'project':
      return typeof value === 'string'
        ? (references?.projects[value] ?? 'Unknown project')
        : String(value)
    case 'money': {
      const amount = Number(value)
      return Number.isFinite(amount) ? MONEY.format(amount) : String(value)
    }
    case 'hours': {
      const hours = Number(value)
      return Number.isFinite(hours) ? `${formatHours(hours)}h` : String(value)
    }
    case 'boolean':
      return value ? 'Yes' : 'No'
    default:
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value)
        } catch {
          return '[object]'
        }
      }
      return String(value)
  }
}

function MembershipChips({
  added,
  removed,
  references,
  resolveNames,
}: {
  added: string[]
  removed: string[]
  references?: ActivityReferences
  resolveNames: boolean
}) {
  const nameFor = (id: string) =>
    resolveNames ? (references?.users[id]?.name ?? 'Unknown user') : id

  return (
    <span className='inline-flex flex-wrap items-center gap-1'>
      {added.map(id => (
        <span
          key={`add:${id}`}
          className='inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200'
        >
          <Plus className='h-3 w-3' aria-hidden='true' />
          <span className='sr-only'>Added </span>
          {nameFor(id)}
        </span>
      ))}
      {removed.map(id => (
        <span
          key={`rm:${id}`}
          className='inline-flex items-center gap-0.5 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-rose-800 dark:text-rose-200'
        >
          <Minus className='h-3 w-3' aria-hidden='true' />
          <span className='sr-only'>Removed </span>
          {nameFor(id)}
        </span>
      ))}
    </span>
  )
}
