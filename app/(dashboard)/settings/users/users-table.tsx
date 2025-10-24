'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Pencil, RefreshCw, User, Trash2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import type { Database } from '@/supabase/types/database'

import { cn } from '@/lib/utils'
import { getStatusBadgeToken } from '@/lib/constants'

import { UserSheet } from '@/app/(dashboard)/settings/users/users-sheet'
import { restoreUser, softDeleteUser } from './actions'

const ROLE_LABELS: Record<Database['public']['Enums']['user_role'], string> = {
  ADMIN: 'Admin',
  CONTRACTOR: 'Contractor',
  CLIENT: 'Client',
}
type UserRow = Database['public']['Tables']['users']['Row']

type Props = {
  users: UserRow[]
  currentUserId: string
  assignments: Record<
    string,
    { clients: number; projects: number; tasks: number }
  >
}

export function UsersSettingsTable({
  users,
  currentUserId,
  assignments,
}: Props) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const deleteTargetRef = useRef<UserRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const pendingReason = 'Please wait for the current request to finish.'
  const selfDeleteReason = 'You cannot delete your own account.'

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [users]
  )

  const handleOpenCreate = () => {
    setSelectedUser(null)
    setSheetOpen(true)
  }

  const handleEdit = (user: UserRow) => {
    setSelectedUser(user)
    setSheetOpen(true)
  }

  const handleClosed = () => {
    setSheetOpen(false)
    void router.refresh()
  }

  const notifySelfDeleteBlocked = () => {
    toast({
      title: 'Cannot delete your own account',
      description:
        'Switch to another administrator before removing your access.',
      variant: 'destructive',
    })
  }

  const handleRequestDelete = (user: UserRow) => {
    if (user.id === currentUserId) {
      notifySelfDeleteBlocked()
      return
    }

    if (user.deleted_at || isPending) {
      return
    }

    setDeleteTarget(user)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return
    }

    if (deleteTarget.id === currentUserId) {
      notifySelfDeleteBlocked()
      setDeleteTarget(null)
      return
    }

    if (deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const user = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(user.id)
    startTransition(async () => {
      try {
        const result = await softDeleteUser({ id: user.id })

        if (result.error) {
          toast({
            title: 'Unable to delete user',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'User deleted',
          description: `${user.full_name ?? user.email} can no longer access the portal.`,
        })
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (user: UserRow) => {
    if (!user.deleted_at) {
      return
    }

    setPendingRestoreId(user.id)
    startTransition(async () => {
      try {
        const result = await restoreUser({ id: user.id })

        if (result.error) {
          toast({
            title: 'Unable to restore user',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'User restored',
          description: `${user.full_name ?? user.email} can access the portal again.`,
        })
        router.refresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  if (deleteTarget && deleteTargetRef.current !== deleteTarget) {
    deleteTargetRef.current = deleteTarget
  }

  const dialogTarget = deleteTarget ?? deleteTargetRef.current

  const formatCount = (count: number, noun: string) =>
    `${count} ${noun}${count === 1 ? '' : 's'}`

  const getAssignmentSummary = (userId: string) =>
    assignments[userId] ?? { clients: 0, projects: 0, tasks: 0 }

  const dialogSummary = dialogTarget
    ? getAssignmentSummary(dialogTarget.id)
    : null
  const dialogTargetName = dialogTarget
    ? (dialogTarget.full_name ?? dialogTarget.email ?? 'this user')
    : null

  const dialogDescription =
    dialogTarget && dialogSummary
      ? `Deleting ${dialogTargetName} removes their access. They are currently assigned to ${formatCount(dialogSummary.clients, 'client')}, ${formatCount(dialogSummary.projects, 'project')}, and ${formatCount(dialogSummary.tasks, 'task')}. Deleting this user will also remove those assignments.`
      : 'Deleting this user removes their access but keeps historical records.'

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Delete user?'
        description={dialogDescription}
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-semibold'>Team members</h2>
          <p className='text-muted-foreground text-sm'>
            Invite administrators, contractors, and clients to collaborate
            inside the portal.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <UserPlus className='h-4 w-4' /> Add user
        </Button>
      </div>
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
            {sortedUsers.map(user => {
              const deleting = isPending && pendingDeleteId === user.id
              const restoring = isPending && pendingRestoreId === user.id
              const deleteDisabled =
                deleting ||
                restoring ||
                user.id === currentUserId ||
                Boolean(user.deleted_at)
              const restoreDisabled = restoring || deleting
              const editDisabled = deleting || restoring
              const editDisabledReason = editDisabled ? pendingReason : null
              const restoreDisabledReason = restoreDisabled
                ? pendingReason
                : null
              const deleteDisabledReason = deleteDisabled
                ? deleting || restoring
                  ? pendingReason
                  : user.id === currentUserId
                    ? selfDeleteReason
                    : null
                : null
              const status = user.deleted_at
                ? { label: 'Inactive', tone: 'inactive' as const }
                : { label: 'Active', tone: 'active' as const }

              return (
                <TableRow
                  key={user.id}
                  className={user.deleted_at ? 'opacity-60' : undefined}
                >
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <User className='text-muted-foreground h-4 w-4' />
                      <span className='font-medium'>
                        {user.full_name ?? user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>
                    {user.email}
                  </TableCell>
                  <TableCell className='text-sm'>
                    {ROLE_LABELS[user.role]}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        'text-xs',
                        getStatusBadgeToken(status.tone)
                      )}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <DisabledFieldTooltip
                        disabled={editDisabled}
                        reason={editDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => handleEdit(user)}
                          title='Edit user'
                          disabled={editDisabled}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                      {user.deleted_at ? (
                        <DisabledFieldTooltip
                          disabled={restoreDisabled}
                          reason={restoreDisabledReason}
                        >
                          <Button
                            variant='secondary'
                            size='icon'
                            onClick={() => handleRestore(user)}
                            title='Restore user'
                            aria-label='Restore user'
                            disabled={restoreDisabled}
                          >
                            <RefreshCw className='h-4 w-4' />
                            <span className='sr-only'>Restore</span>
                          </Button>
                        </DisabledFieldTooltip>
                      ) : (
                        <DisabledFieldTooltip
                          disabled={deleteDisabled}
                          reason={deleteDisabledReason}
                        >
                          <Button
                            variant='destructive'
                            size='icon'
                            onClick={() => handleRequestDelete(user)}
                            title={
                              user.id === currentUserId
                                ? 'Cannot delete your own account'
                                : 'Delete user'
                            }
                            aria-label='Delete user'
                            disabled={deleteDisabled}
                          >
                            <Trash2 className='h-4 w-4' />
                            <span className='sr-only'>Delete</span>
                          </Button>
                        </DisabledFieldTooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {sortedUsers.length === 0 ? (
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
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleClosed}
        user={selectedUser}
        currentUserId={currentUserId}
      />
    </div>
  )
}
