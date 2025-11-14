import { format } from 'date-fns'
import { Archive, Loader2, Pencil, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/auth/session'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'
import type { ProjectTimeLogHistoryState } from '@/lib/projects/time-log/use-project-time-log-history'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const resolveLoggedOnDate = (value: string | null) => {
  if (!value) {
    return null
  }

  if (value.includes('T')) {
    return new Date(value)
  }

  return new Date(`${value}T00:00:00`)
}

type ProjectTimeLogHistoryContentProps = {
  state: ProjectTimeLogHistoryState
  currentUserId: string
  currentUserRole: UserRole
  canLogTime: boolean
  onEditEntry: (entry: TimeLogEntry) => void
}

export function ProjectTimeLogHistoryContent(
  props: ProjectTimeLogHistoryContentProps
) {
  const { state, currentUserId, currentUserRole, canLogTime, onEditEntry } =
    props
  const {
    logs,
    totalCount,
    isLoading,
    isError,
    refresh,
    showLoadMore,
    loadMore,
    deleteState,
  } = state

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-muted-foreground text-sm'>
          Showing {logs.length} of {totalCount}
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={refresh}
          disabled={isLoading}
          className='inline-flex items-center gap-2'
        >
          {isLoading ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <RotateCcw className='size-4' />
          )}
          Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='size-4 animate-spin' /> Loading time logs…
        </div>
      ) : isError ? (
        <div className='text-destructive border-destructive/40 bg-destructive/10 flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
          <span>Unable to load time logs.</span>
          <Button type='button' variant='outline' size='sm' onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : logs.length === 0 ? (
        <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
          No time entries logged for this project yet.
        </div>
      ) : (
        <div className='overflow-hidden rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40'>
                <TableHead className='min-w-28'>Logged on</TableHead>
                <TableHead className='min-w-20'>Hours</TableHead>
                <TableHead className='min-w-48'>Tasks</TableHead>
                <TableHead className='min-w-36'>Member</TableHead>
                <TableHead className='min-w-48'>Notes</TableHead>
                <TableHead className='w-20 text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <ProjectTimeLogHistoryRow
                  key={log.id}
                  log={log}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  canLogTime={canLogTime}
                  onDeleteRequest={deleteState.request}
                  onEditRequest={onEditEntry}
                  isDeleting={deleteState.isMutating}
                  pendingDeleteId={deleteState.pendingEntryId}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {showLoadMore ? (
        <div className='flex justify-center'>
          <Button
            type='button'
            variant='outline'
            onClick={loadMore}
            disabled={isLoading}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type ProjectTimeLogHistoryRowProps = {
  log: TimeLogEntry
  currentUserId: string
  currentUserRole: UserRole
  canLogTime: boolean
  onDeleteRequest: (entry: TimeLogEntry) => void
  onEditRequest: (entry: TimeLogEntry) => void
  isDeleting: boolean
  pendingDeleteId: string | null
}

function ProjectTimeLogHistoryRow(props: ProjectTimeLogHistoryRowProps) {
  const {
    log,
    currentUserId,
    currentUserRole,
    canLogTime,
    onDeleteRequest,
    onEditRequest,
    isDeleting,
    pendingDeleteId,
  } = props

  const authorName = log.user?.full_name ?? log.user?.email ?? 'Unknown user'
  const loggedOnDate = resolveLoggedOnDate(log.logged_on)
  const loggedDate = loggedOnDate
    ? format(loggedOnDate, 'MMM d, yyyy')
    : 'Unknown date'
  const canModify =
    canLogTime && (currentUserRole === 'ADMIN' || log.user_id === currentUserId)
  const deleteDisabled = isDeleting
  const deleteReason = deleteDisabled ? 'Removing entry...' : null

  const visibleTaskLinks = (log.linked_tasks ?? []).filter(
    (
      link
    ): link is NonNullable<
      NonNullable<TimeLogEntry['linked_tasks']>[number]
    > => {
      if (!link) {
        return false
      }
      if (link.deleted_at) {
        return false
      }
      if (!link.task || link.task.deleted_at) {
        return false
      }
      return true
    }
  )

  return (
    <TableRow>
      <TableCell>
        <div className='flex flex-col'>
          <span className='font-medium'>{loggedDate}</span>
        </div>
      </TableCell>
      <TableCell className='font-semibold'>
        {HOURS_FORMATTER.format(Number(log.hours ?? 0))} hrs
      </TableCell>
      <TableCell>
        {visibleTaskLinks.length === 0 ? (
          <span className='text-muted-foreground text-sm'>
            Logged to project
          </span>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {visibleTaskLinks.map(link => (
              <Badge key={link.task?.id ?? link.id} variant='secondary'>
                {link.task?.title ?? 'Untitled task'}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell>
        <span className='line-clamp-2 text-sm'>{authorName}</span>
      </TableCell>
      <TableCell>
        {log.note ? (
          <span className='text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap'>
            {log.note}
          </span>
        ) : (
          <span className='text-muted-foreground text-sm'>—</span>
        )}
      </TableCell>
      <TableCell className='text-right'>
        {canModify ? (
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='h-8 w-8 rounded-md'
              onClick={() => onEditRequest(log)}
              aria-label='Edit time entry'
            >
              <Pencil className='size-4' />
            </Button>
            <DisabledFieldTooltip
              disabled={deleteDisabled}
              reason={deleteReason}
            >
              <Button
                type='button'
                variant='destructive'
                size='icon'
                className={cn(
                  'h-8 w-8 rounded-md',
                  isDeleting && pendingDeleteId === log.id
                    ? 'pointer-events-none'
                    : undefined
                )}
                onClick={() => onDeleteRequest(log)}
                disabled={deleteDisabled}
                aria-label='Delete time entry'
              >
                {isDeleting && pendingDeleteId === log.id ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <Archive className='size-4' />
                )}
              </Button>
            </DisabledFieldTooltip>
          </div>
        ) : (
          <span className='text-muted-foreground text-xs'>No access</span>
        )}
      </TableCell>
    </TableRow>
  )
}
