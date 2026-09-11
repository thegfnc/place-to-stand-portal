'use client'

import { format, parseISO } from 'date-fns'
import { Clock, Plus } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Skeleton } from '@pts/ui/skeleton'
import { getInitials } from '@/lib/users/initials'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

import { SheetEmptyState } from '@/components/sheets/sheet-empty-state'
import { useTaskTimeLogs } from './use-task-time-logs'

type TimeLogSectionProps = {
  taskId: string
  enabled: boolean
  logTimeDisabledReason: string | null
  onLogTime: () => void
  onEditEntry: (entry: TimeLogEntry) => void
}

export function TimeLogSection({
  taskId,
  enabled,
  logTimeDisabledReason,
  onLogTime,
  onEditEntry,
}: TimeLogSectionProps) {
  const { entries, totalHours, isLoading, isError } = useTaskTimeLogs(
    taskId,
    enabled
  )

  const logTimeDisabled = Boolean(logTimeDisabledReason)

  return (
    // No bottom padding: it used to mirror the form's own pb-4, but the form
    // no longer has one — the scroll column's gap-6 is the single source of
    // separation between these sections now.
    // space-y-1 matches the attachments field, so the heading sits the same
    // distance above its content in both sections.
    <section className='space-y-1 px-6' aria-label='Time logged on this task'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Clock className='text-muted-foreground h-4 w-4' />
          <h3 className='text-sm font-medium'>Time Logs</h3>
          <span className='text-muted-foreground text-sm'>
            {totalHours}h logged
          </span>
        </div>
        <DisabledFieldTooltip
          disabled={logTimeDisabled}
          reason={logTimeDisabledReason}
        >
          {/* Matches the Attachments add button: icon-only ghost, labelled
              for AT since the text label is gone. */}
          <Button
            type='button'
            size='xs'
            variant='ghost'
            disabled={logTimeDisabled}
            onClick={onLogTime}
            aria-label='Log time'
          >
            <Plus className='h-4 w-4' />
          </Button>
        </DisabledFieldTooltip>
      </div>
      {isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
        </div>
      ) : isError ? (
        <p className='text-muted-foreground text-sm'>
          Time logs could not be loaded.
        </p>
      ) : entries.length === 0 ? (
        <SheetEmptyState
          message='No time logged yet.'
          label='Log time'
          onClick={onLogTime}
          disabled={logTimeDisabled}
        />
      ) : (
        <ul className='divide-border divide-y rounded-md border'>
          {entries.map(entry => (
            <li key={entry.id}>
              <button
                type='button'
                onClick={() => onEditEntry(entry)}
                className='hover:bg-muted/50 flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors'
              >
                {/* Avatar instead of the logger's name: the row has one line
                    for date, hours, person and note, and the note is the part
                    that needs the room. It leads the row — same identity-first
                    reading order as the comments thread above — with the name
                    still reachable by hover and by AT. */}
                <span className='shrink-0' title={resolveLoggerName(entry)}>
                  <Avatar className='h-5 w-5'>
                    {entry.user?.avatar_url ? (
                      <AvatarImage
                        src={`/api/storage/user-avatar/${entry.user.id}`}
                        alt=''
                      />
                    ) : null}
                    <AvatarFallback className='text-[9px]'>
                      {getInitials(resolveLoggerName(entry))}
                    </AvatarFallback>
                  </Avatar>
                  <span className='sr-only'>
                    Logged by {resolveLoggerName(entry)}
                  </span>
                </span>
                <span className='text-muted-foreground w-24 shrink-0 tabular-nums'>
                  {formatLoggedOn(entry.logged_on)}
                </span>
                {/* Right-aligned so `0.5h` and `12.5h` line up down the column
                    and the number sits flush against the note. */}
                <span className='w-12 shrink-0 text-right font-medium tabular-nums'>
                  {entry.hours}h
                </span>
                {entry.note ? (
                  <span className='text-muted-foreground min-w-0 flex-1 truncate'>
                    {entry.note}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatLoggedOn(loggedOn: string): string {
  try {
    return format(parseISO(loggedOn), 'MMM d, yyyy')
  } catch {
    return loggedOn
  }
}

function resolveLoggerName(entry: TimeLogEntry): string {
  return (
    entry.user?.full_name?.trim() ||
    entry.user?.email?.split('@')[0] ||
    'Unknown'
  )
}
