'use client'

import { format } from 'date-fns'
import { Archive, Pencil, RefreshCw, Trash2, User } from 'lucide-react'

import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { cn } from '@/lib/utils'
import { getStatusBadgeToken } from '@/lib/constants'
import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'

const ROLE_LABELS: Record<UserRowState['user']['role'], string> = {
  ADMIN: 'Admin',
  CLIENT: 'Client',
}

type UsersTableRowProps = {
  row: UserRowState
  selfDeleteReason: string
  mode: 'active' | 'archive'
}

export function UsersTableRow({
  row,
  selfDeleteReason,
  mode,
}: UsersTableRowProps) {
  const { user } = row
  const deleteTitle =
    row.deleteDisabled && row.deleteDisabledReason === selfDeleteReason
      ? 'Cannot delete your own account'
      : 'Delete user'
  const showEdit = mode === 'active'
  const showSoftDelete = mode === 'active'
  const showRestore = mode === 'archive'
  const showDestroy = mode === 'archive'

  return (
    <TableRow className={user.deleted_at ? 'opacity-60' : undefined}>
      <TableCell>
        <div className='flex items-center gap-2'>
          <User className='text-muted-foreground h-4 w-4' />
          <span className='font-medium'>{user.full_name ?? user.email}</span>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {user.email}
      </TableCell>
      <TableCell className='text-sm'>{ROLE_LABELS[user.role]}</TableCell>
      <TableCell>
        <Badge className={cn('text-xs', getStatusBadgeToken(row.status.tone))}>
          {row.status.label}
        </Badge>
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {format(new Date(user.created_at), 'MMM d, yyyy')}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-2'>
          {showEdit ? (
            <DisabledFieldTooltip
              disabled={row.editDisabled}
              reason={row.editDisabledReason}
            >
              <Button
                variant='outline'
                size='icon'
                onClick={row.onEdit}
                title='Edit user'
                disabled={row.editDisabled}
              >
                <Pencil className='h-4 w-4' />
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          {showRestore ? (
            <DisabledFieldTooltip
              disabled={row.restoreDisabled}
              reason={row.restoreDisabledReason}
            >
              <Button
                variant='secondary'
                size='icon'
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
            >
              <Button
                variant='destructive'
                size='icon'
                onClick={row.onRequestDelete}
                title={deleteTitle}
                aria-label='Delete user'
                disabled={row.deleteDisabled}
              >
                <Archive className='h-4 w-4' />
                <span className='sr-only'>Delete</span>
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          {showDestroy ? (
            <DisabledFieldTooltip
              disabled={row.destroyDisabled}
              reason={row.destroyDisabledReason}
            >
              <Button
                variant='destructive'
                size='icon'
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
