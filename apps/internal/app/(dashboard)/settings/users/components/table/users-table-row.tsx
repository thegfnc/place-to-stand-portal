'use client'

import { Archive, RefreshCw, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { TableCell, TableRow } from '@pts/ui/table'
import { Button } from '@pts/ui/button'
import { Badge } from '@/components/ui/badge'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Switch } from '@pts/ui/switch'
import type { UserAssignmentSummary } from '@/lib/queries/users/assignments'
import {
  USER_ROLE_BADGE_CLASSES,
  USER_ROLE_LABELS,
} from '@/lib/settings/users/filters'

import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'
import { cn } from '@/lib/utils'
import { formatCalendarDate } from '@/lib/dates'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { UserAssignmentsCell } from './user-assignments-cell'

type UsersTableRowProps = {
  row: UserRowState
  assignment: UserAssignmentSummary | undefined
  selfDeleteReason: string
  mode: 'active' | 'archive'
}

export function UsersTableRow({
  row,
  assignment,
  selfDeleteReason,
  mode,
}: UsersTableRowProps) {
  const { user } = row
  const deleteTitle =
    row.deleteDisabled && row.deleteDisabledReason === selfDeleteReason
      ? 'Cannot archive your own account'
      : 'Archive user'
  const showSoftDelete = mode === 'active'
  const showRestore = mode === 'archive'
  const showDestroy = mode === 'archive'

  const displayName = user.full_name ?? user.email
  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map(segment => segment[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase()

  return (
    <TableRow
      {...getClickableRowProps(row.onEdit)}
      className={cn(CLICKABLE_ROW_CLASS, user.deleted_at && ARCHIVED_ROW_CLASS)}
    >
      <TableCell>
        <div className='flex min-w-0 items-center gap-2'>
          <Avatar className='h-6 w-6 shrink-0'>
            {user.avatar_url && (
              <AvatarImage src={`/api/storage/user-avatar/${user.id}`} />
            )}
            <AvatarFallback className='text-[10px]'>{initials}</AvatarFallback>
          </Avatar>
          <span className='truncate font-medium'>{displayName}</span>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground hidden truncate text-sm md:table-cell'>
        {user.email}
      </TableCell>
      <TableCell className='hidden md:table-cell'>
        <Badge
          variant='outline'
          className={cn('text-xs', USER_ROLE_BADGE_CLASSES[user.role])}
        >
          {USER_ROLE_LABELS[user.role]}
        </Badge>
      </TableCell>
      <TableCell>
        {mode === 'active' ? (
          <DisabledFieldTooltip
            disabled={row.accessToggleDisabled}
            reason={row.accessToggleDisabledReason}
            className='w-auto'
          >
            <div className='flex items-center gap-2'>
              <Switch
                checked={row.accessEnabled}
                onCheckedChange={row.onToggleAccess}
                disabled={row.accessToggleDisabled}
                aria-label={
                  row.accessEnabled
                    ? `Disable sign-in for ${displayName}`
                    : `Enable sign-in for ${displayName}`
                }
              />
              <span className='text-muted-foreground text-xs'>
                {row.accessEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </DisabledFieldTooltip>
        ) : (
          <span className='text-muted-foreground text-xs'>—</span>
        )}
      </TableCell>
      <TableCell className='hidden md:table-cell'>
        <UserAssignmentsCell assignment={assignment} role={user.role} />
      </TableCell>
      <TableCell className='text-muted-foreground hidden truncate text-sm md:table-cell'>
        {formatCalendarDate(user.created_at)}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-2'>
          {showRestore ? (
            <DisabledFieldTooltip
              disabled={row.restoreDisabled}
              reason={row.restoreDisabledReason}
            >
              <Button
                variant='outline'
                size='icon-sm'
                onClick={row.onRestore}
                title='Restore user'
                aria-label='Restore user'
                disabled={row.restoreDisabled}
              >
                <RefreshCw className='h-4 w-4' />
                <span className='sr-only'>Restore</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          {showSoftDelete ? (
            <DisabledFieldTooltip
              disabled={row.deleteDisabled}
              reason={row.deleteDisabledReason}
              className='w-auto'
            >
              <Button
                variant='destructive'
                size='icon-sm'
                onClick={row.onRequestDelete}
                title={deleteTitle}
                aria-label='Archive user'
                disabled={row.deleteDisabled}
              >
                <Archive className='h-4 w-4' />
                <span className='sr-only'>Archive</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          {showDestroy ? (
            <DisabledFieldTooltip
              disabled={row.destroyDisabled}
              reason={row.destroyDisabledReason}
              className='w-auto'
            >
              <Button
                variant='destructive'
                size='icon-sm'
                onClick={row.onRequestDestroy}
                title='Permanently delete user'
                aria-label='Permanently delete user'
                disabled={row.destroyDisabled}
              >
                <Trash2 className='h-4 w-4' />
                <span className='sr-only'>Delete permanently</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}
