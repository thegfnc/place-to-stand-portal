'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import type { PageInfo } from '@/lib/pagination/cursor'
import type { ClientUserSummary } from '@/lib/settings/clients/client-sheet-utils'
import {
  type ClientsTableClient,
  useClientsTableState,
} from '@/lib/settings/clients/use-clients-table-state'

import { ClientsTableSection } from './clients-table-section'
import { ClientSheet } from './clients-sheet'

type ClientsManagementTableProps = {
  clients: ClientsTableClient[]
  clientUsers: ClientUserSummary[]
  membersByClient: Record<string, ClientUserSummary[]>
  pageInfo: PageInfo
  totalCount: number
  mode: 'active' | 'archive'
}

const EMPTY_MESSAGES = {
  active: 'No clients yet. Create one to begin organizing projects.',
  archive: 'No archived clients. Archived clients appear here once deleted.',
} as const

export function ClientsManagementTable({
  clients,
  clientUsers,
  membersByClient,
  pageInfo,
  totalCount,
  mode,
}: ClientsManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    sheetOpen,
    selectedClient,
    deleteTarget,
    destroyTarget,
    isPending,
    pendingReason,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    openEdit,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRestore,
    handleRequestDestroy,
    handleCancelDestroy,
    handleConfirmDestroy,
  } = useClientsTableState()

  const emptyMessage = EMPTY_MESSAGES[mode]

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

  const paginationState = useMemo(
    () => ({
      hasNextPage: pageInfo.hasNextPage,
      hasPreviousPage: pageInfo.hasPreviousPage,
    }),
    [pageInfo.hasNextPage, pageInfo.hasPreviousPage]
  )

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive client?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name} hides it from selectors and reporting. Existing projects stay linked.`
            : 'Archiving this client hides it from selectors and reporting. Existing projects stay linked.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete client?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.name} removes this client and its memberships. This action cannot be undone.`
            : 'Permanently deleting this client removes it and its memberships. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <ClientsTableSection
        clients={clients}
        mode={mode === 'archive' ? 'archive' : 'active'}
        onEdit={openEdit}
        onRequestDelete={handleRequestDelete}
        onRestore={handleRestore}
        onRequestDestroy={handleRequestDestroy}
        isPending={isPending}
        pendingReason={pendingReason}
        pendingDeleteId={pendingDeleteId}
        pendingRestoreId={pendingRestoreId}
        pendingDestroyId={pendingDestroyId}
        emptyMessage={emptyMessage}
      />
      <PaginationControls
        hasNextPage={paginationState.hasNextPage}
        hasPreviousPage={paginationState.hasPreviousPage}
        onNext={() => handlePaginate('forward')}
        onPrevious={() => handlePaginate('backward')}
        disableAll={isPending}
      />
      <div className='flex w-full justify-end'>
        <span className='text-muted-foreground text-right text-sm'>
          Total clients: {totalCount}
        </span>
      </div>
      <ClientSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        client={selectedClient}
        allClientUsers={clientUsers}
        clientMembers={membersByClient}
      />
    </div>
  )
}

type PaginationControlsProps = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  onNext: () => void
  onPrevious: () => void
  disableAll?: boolean
}

function PaginationControls({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  disableAll = false,
}: PaginationControlsProps) {
  const isPrevDisabled = disableAll || !hasPreviousPage
  const isNextDisabled = disableAll || !hasNextPage

  if (!hasNextPage && !hasPreviousPage) {
    return null
  }

  return (
    <div className='flex justify-end gap-2'>
      <Button
        type='button'
        variant='outline'
        onClick={onPrevious}
        disabled={isPrevDisabled}
      >
        Previous
      </Button>
      <Button type='button' onClick={onNext} disabled={isNextDisabled}>
        Next
      </Button>
    </div>
  )
}
