'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaginationControls } from '@/components/ui/pagination-controls'
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
  type UserRowState,
} from '@/lib/settings/users/state/use-users-table-state'
import type { UserRow } from '@/lib/settings/users/state/types'
import type { PageInfo } from '@/lib/pagination/cursor'

import { UsersTableRow } from './components/table/users-table-row'

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
  tab: UsersTab
  pageInfo: PageInfo
  totalCount: number
}

type UsersTab = 'users' | 'archive' | 'activity'

export function UsersSettingsTable({
  users,
  currentUserId,
  assignments,
  tab,
  pageInfo,
  totalCount,
}: Props) {
  const {
    rows,
    sheet,
    deleteDialog,
    destroyDialog,
    onOpenCreate,
    selfDeleteReason,
    isPending,
  } = useUsersTableState({ users, currentUserId, assignments })
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeRows = useMemo(
    () => rows.filter(row => !row.user.deleted_at),
    [rows]
  )
  const archivedRows = useMemo(
    () => rows.filter(row => Boolean(row.user.deleted_at)),
    [rows]
  )
  const showAddButton = tab === 'users'
  const showListViews = tab !== 'activity'

  const handleTabChange = (next: UsersTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'users') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    params.delete('cursor')
    params.delete('dir')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handlePaginate = (direction: 'forward' | 'backward') => {
    const cursor =
      direction === 'forward' ? pageInfo.endCursor : pageInfo.startCursor

    if (!cursor) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('cursor', cursor)
    params.set('dir', direction)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const paginationDisabled = !showListViews

  const paginationState = useMemo(
    () => ({
      hasNextPage: pageInfo.hasNextPage && !paginationDisabled,
      hasPreviousPage: pageInfo.hasPreviousPage && !paginationDisabled,
    }),
    [pageInfo.hasNextPage, pageInfo.hasPreviousPage, paginationDisabled]
  )

  return (
    <div className='space-y-6'>
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
        open={destroyDialog.open}
        title='Permanently delete user?'
        description={destroyDialog.description}
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={destroyDialog.confirmDisabled}
        onCancel={destroyDialog.onCancel}
        onConfirm={destroyDialog.onConfirm}
      />
      <Tabs
        value={tab}
        onValueChange={value => handleTabChange(value as UsersTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='users'>Users</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {showAddButton ? (
            <Button onClick={onOpenCreate} className='ml-auto'>
              <UserPlus className='h-4 w-4' /> Add user
            </Button>
          ) : null}
        </div>
        <TabsContent value='users' className='space-y-6'>
          {tab === 'users' ? (
            <>
              <UsersTableSection
                rows={activeRows}
                mode='active'
                emptyMessage='No users found. Use the Add user button to invite someone.'
                selfDeleteReason={selfDeleteReason}
              />
              <PaginationControls
                hasNextPage={paginationState.hasNextPage}
                hasPreviousPage={paginationState.hasPreviousPage}
                onNext={() => handlePaginate('forward')}
                onPrevious={() => handlePaginate('backward')}
                disableAll={isPending}
              />
            </>
          ) : null}
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          {tab === 'archive' ? (
            <>
              <UsersTableSection
                rows={archivedRows}
                mode='archive'
                emptyMessage='No archived users. Archived accounts appear here once deleted.'
                selfDeleteReason={selfDeleteReason}
              />
              <PaginationControls
                hasNextPage={paginationState.hasNextPage}
                hasPreviousPage={paginationState.hasPreviousPage}
                onNext={() => handlePaginate('forward')}
                onPrevious={() => handlePaginate('backward')}
                disableAll={isPending}
              />
            </>
          ) : null}
        </TabsContent>
        <TabsContent value='activity' className='space-y-3'>
          <div className='space-y-3 p-1'>
            <div>
              <h3 className='text-lg font-semibold'>Recent activity</h3>
              <p className='text-muted-foreground text-sm'>
                Keep tabs on invitations, role updates, and archive decisions.
              </p>
            </div>
            <UsersActivityFeed
              targetType='USER'
              pageSize={20}
              emptyState='No recent user management activity.'
              requireContext={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      {showListViews ? (
        <div className='flex w-full justify-end'>
          <span className='text-muted-foreground text-right text-sm'>
            Total users: {totalCount}
          </span>
        </div>
      ) : null}
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

type UsersTableSectionProps = {
  rows: UserRowState[]
  mode: 'active' | 'archive'
  emptyMessage: string
  selfDeleteReason: string
}

function UsersTableSection({
  rows,
  mode,
  emptyMessage,
  selfDeleteReason,
}: UsersTableSectionProps) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <UsersTableRow
              key={row.user.id}
              row={row}
              mode={mode}
              selfDeleteReason={selfDeleteReason}
            />
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

