'use client'

import dynamic from 'next/dynamic'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { UserSheet } from '@/app/(dashboard)/settings/users/users-sheet'
import {
  useUsersTableState,
  type UserAssignments,
} from '@/lib/settings/users/state/use-users-table-state'

import { UsersTableRow } from './components/table/users-table-row'
import { UsersTableToolbar } from './components/table/users-table-toolbar'

import type { Database } from '@/supabase/types/database'

type UserRow = Database['public']['Tables']['users']['Row']

const UsersActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity…
      </div>
    ),
  }
)

type Props = {
  users: UserRow[]
  currentUserId: string
  assignments: UserAssignments
}

export function UsersSettingsTable({
  users,
  currentUserId,
  assignments,
}: Props) {
  const { rows, sheet, deleteDialog, onOpenCreate, selfDeleteReason } =
    useUsersTableState({ users, currentUserId, assignments })

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={deleteDialog.open}
        title='Delete user?'
        description={deleteDialog.description}
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={deleteDialog.confirmDisabled}
        onCancel={deleteDialog.onCancel}
        onConfirm={deleteDialog.onConfirm}
      />
      <UsersTableToolbar onAddUser={onOpenCreate} />
      <div className='overflow-hidden rounded-xl border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className='w-28 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <UsersTableRow
                key={row.user.id}
                row={row}
                selfDeleteReason={selfDeleteReason}
              />
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  No users found. Use the Add user button to invite someone.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <UserSheet
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        onComplete={sheet.onComplete}
        user={sheet.selectedUser}
        currentUserId={currentUserId}
      />
      <div className='space-y-3 rounded-xl border p-4'>
        <div>
          <h3 className='text-lg font-semibold'>Recent activity</h3>
          <p className='text-muted-foreground text-sm'>
            Keep tabs on invitations, role updates, and archive decisions.
          </p>
        </div>
        <UsersActivityFeed
          targetType='USER'
          pageSize={15}
          emptyState='No recent user management activity.'
          requireContext={false}
        />
      </div>
    </div>
  )
}
