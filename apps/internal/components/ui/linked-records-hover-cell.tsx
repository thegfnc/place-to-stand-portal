'use client'

import { useCallback, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

export type LinkedRecordItem = {
  id: string
  label: string
  sublabel?: string | null
  /** Omit to render the row as plain text instead of a link. */
  href?: string
  /** Rendered after the label, e.g. a status Badge. */
  trailing?: ReactNode
}

type LinkedRecordsHoverCellProps = {
  count: number
  /** Text after the number, e.g. ' active'. */
  label?: string
  /** Zero-state text; defaults to `0` followed by `label`. */
  zeroLabel?: string
  /** Replaces the `count + label` trigger text, e.g. `(4 total)`. */
  triggerLabel?: string
  items: LinkedRecordItem[]
  icon: LucideIcon
  /** Screen-reader name for the bare-number trigger, e.g. "3 clients". */
  ariaLabel?: string
  /** Controlled open state for coordinated cards (see useCoordinatedHoverCards). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Tone for the trigger text; defaults to `text-foreground`. */
  triggerClassName?: string
  /** Width overrides for the card; defaults to `w-auto min-w-56`. */
  contentClassName?: string
  align?: 'start' | 'center' | 'end'
}

const TRIGGER_CLASS =
  'cursor-pointer border-b border-dotted border-current transition hover:border-solid focus:outline-none'
const ROW_CLASS = 'flex items-center gap-2 px-3 py-2 text-sm'

/**
 * A count that opens a HoverCard listing the records behind it — linked
 * clients on a contact, projects on a client, assignments on a user. Rows
 * link out when they carry an `href`; the zero state is a muted number with
 * no card.
 */
export function LinkedRecordsHoverCell({
  count,
  label,
  zeroLabel,
  triggerLabel,
  items,
  icon: Icon,
  ariaLabel,
  open,
  onOpenChange,
  triggerClassName,
  contentClassName,
  align = 'start',
}: LinkedRecordsHoverCellProps) {
  if (count === 0) {
    return (
      <span className='text-muted-foreground/50'>
        {zeroLabel ?? `0${label ?? ''}`}
      </span>
    )
  }

  return (
    <HoverCard open={open} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild>
        <button
          type='button'
          aria-label={ariaLabel}
          className={cn(TRIGGER_CLASS, triggerClassName ?? 'text-foreground')}
        >
          {triggerLabel ?? `${count}${label ?? ''}`}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align={align}
        className={cn('w-auto min-w-56 p-0', contentClassName)}
      >
        <ul className='max-h-80 overflow-y-auto py-1'>
          {items.map(item => (
            <li key={item.id}>
              <LinkedRecordRow item={item} icon={Icon} />
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  )
}

function LinkedRecordRow({
  item,
  icon: Icon,
}: {
  item: LinkedRecordItem
  icon: LucideIcon
}) {
  const content = (
    <>
      <Icon className='text-muted-foreground h-4 w-4 shrink-0' />
      <span className='min-w-0 flex-1'>
        <span className='block truncate'>{item.label}</span>
        {item.sublabel ? (
          <span className='text-muted-foreground block truncate text-xs'>
            {item.sublabel}
          </span>
        ) : null}
      </span>
      {item.trailing}
    </>
  )

  if (!item.href) {
    return <div className={ROW_CLASS}>{content}</div>
  }

  return (
    <Link
      href={item.href}
      className={cn(ROW_CLASS, 'hover:bg-accent transition-colors')}
    >
      {content}
    </Link>
  )
}

/**
 * Coordinates sibling hover cards so opening one force-closes the other —
 * the wrapper's 50ms open / 200ms close timers would otherwise show both for
 * ~150ms when sliding between adjacent triggers. A close only clears the
 * shared state if that card still owns it, so a stale close from the
 * previous card can't wipe the one that just opened.
 */
export function useCoordinatedHoverCards<Key extends string>() {
  const [openKey, setOpenKey] = useState<Key | null>(null)

  return useCallback(
    (key: Key) => ({
      open: openKey === key,
      onOpenChange: (next: boolean) =>
        setOpenKey(current => (next ? key : current === key ? null : current)),
    }),
    [openKey]
  )
}
