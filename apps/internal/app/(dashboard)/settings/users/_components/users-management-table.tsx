'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import { UserSheet } from '../users-sheet'
import {
  DEFAULT_USER_ACCESS,
  isUserAccess,
  isUserRole,
} from '@/lib/settings/users/filters'
import type { UsersSettingsAssignments } from '@/lib/queries/users/assignments'
import { useUsersTableState } from '@/lib/settings/users/state/use-users-table-state'
import type { UserRow } from '@/lib/settings/users/state/types'

import { UsersTableSection } from './users-table-section'

type UsersManagementTableProps = {
  users: UserRow[]
  currentUserId: string
  assignments: UsersSettingsAssignments
  page: number
  pageSize: number
  totalPages: number
  totalCount: number
  mode: 'active' | 'archive'
  basePath: string
  /**
   * User resolved server-side from the `?user=` share link. May not be in
   * `users` when it sits on another page or is filtered out.
   */
  deepLinkedUser?: UserRow | null
  /** True when `?user=` points at a user that no longer exists. */
  userNotFound?: boolean
}

const EMPTY_MESSAGES = {
  active: 'No users found. Use the Add user button to invite someone.',
  archive: 'No archived users. Archived accounts appear here once deleted.',
} as const

export function UsersManagementTable({
  users,
  currentUserId,
  assignments,
  page,
  pageSize,
  totalPages,
  totalCount,
  mode,
  basePath,
  deepLinkedUser = null,
  userNotFound = false,
}: UsersManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    rows,
    sheet,
    deleteDialog,
    destroyDialog,
    disableDialog,
    selfDeleteReason,
  } = useUsersTableState({
    users,
    currentUserId,
    assignments,
    deepLinkedUser,
  })
  // Dismissing the not-found notice just drops the stale `?user=`.
  const dismissDeepLink = () => sheet.onOpenChange(false)

  const filteredRows = useMemo(
    () =>
      mode === 'active'
        ? rows.filter(row => !row.user.deleted_at)
        : rows.filter(row => Boolean(row.user.deleted_at)),
    [rows, mode]
  )

  // Run raw params through the type guards (R4): ?role=SUPERADMIN is ignored
  // by the server, so it must not count as an active filter — an unfiltered
  // empty list would otherwise show the wrong message.
  const accessParam = searchParams.get('access') ?? undefined
  const hasActiveFilter =
    isUserRole(searchParams.get('role') ?? undefined) ||
    (isUserAccess(accessParam) && accessParam !== DEFAULT_USER_ACCESS) ||
    Boolean(searchParams.get('q')?.trim())

  const emptyMessage = hasActiveFilter
    ? 'No users match the current filters.'
    : EMPTY_MESSAGES[mode]

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(nextPage))
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className='space-y-4'>
      {userNotFound ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked user could not be found. They may have been permanently
            deleted.
          </span>
          <Button variant='ghost' size='sm' onClick={dismissDeepLink}>
            Dismiss
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={deleteDialog.open}
        title='Archive user?'
        description={deleteDialog.description}
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={deleteDialog.confirmDisabled}
        onCancel={deleteDialog.onCancel}
        onConfirm={deleteDialog.onConfirm}
      />
      <ConfirmDialog
        open={disableDialog.open}
        title='Disable sign-in?'
        description={disableDialog.description}
        confirmLabel='Disable'
        confirmVariant='destructive'
        confirmDisabled={disableDialog.confirmDisabled}
        onCancel={disableDialog.onCancel}
        onConfirm={disableDialog.onConfirm}
      />
      <ConfirmDialog
        open={destroyDialog.open}
        title='Permanently delete user?'
        description={destroyDialog.description}
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={destroyDialog.confirmDisabled}
        onCancel={destroyDialog.onCancel}
        onConfirm={destroyDialog.onConfirm}
      />
      <UsersTableSection
        basePath={basePath}
        rows={filteredRows}
        assignments={assignments}
        mode={mode}
        emptyMessage={emptyMessage}
        selfDeleteReason={selfDeleteReason}
      />
      <PaginationControls
        mode='paged'
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
      <UserSheet
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        onComplete={sheet.onComplete}
        user={sheet.selectedUser}
        currentUserId={currentUserId}
        assignments={assignments}
      />
    </div>
  )
}
