'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

import type { PageInfo } from '@/lib/pagination/cursor'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { isClientBilling } from '@/lib/settings/clients/filters'
import {
  type ClientsTableClient,
  useClientsTableState,
} from '@/lib/settings/clients/use-clients-table-state'

import { ClientsTableSection } from './clients-table-section'
import { ClientSheet } from './clients-sheet'

type ClientsManagementTableProps = {
  clients: ClientsTableClient[]
  pageInfo: PageInfo
  /** Rows-per-page the list was served with (drives the footer selector). */
  pageSize: number
  mode: 'active' | 'archive'
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
  /**
   * Client resolved server-side from the `?client=` share link. May not be
   * in `clients` when it sits on another page or is filtered out.
   */
  deepLinkedClient?: ClientRow | null
  /** True when `?client=` points at a client that no longer exists. */
  clientNotFound?: boolean
}

const EMPTY_MESSAGES = {
  active: 'No clients yet. Create one to begin organizing projects.',
  archive: 'No archived clients. Archived clients appear here once deleted.',
} as const

export function ClientsManagementTable({
  clients,
  pageInfo,
  pageSize,
  mode,
  basePath,
  deepLinkedClient = null,
  clientNotFound = false,
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
    clearSelection,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRestore,
    handleRequestDestroy,
    handleCancelDestroy,
    handleConfirmDestroy,
  } = useClientsTableState({ clients, deepLinkedClient })

  // Guard-validated active filters (R4): an empty list under a live `?q=` or
  // `?billing=` shows the filtered message, not the tab's default empty state.
  const hasActiveFilter =
    Boolean(searchParams.get('q')?.trim()) ||
    isClientBilling(searchParams.get('billing') ?? undefined)
  const emptyMessage = hasActiveFilter
    ? 'No clients match the current filters.'
    : EMPTY_MESSAGES[mode]

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
    <div className='space-y-4'>
      {clientNotFound ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked client could not be found. It may have been permanently
            deleted.
          </span>
          <Button variant='ghost' size='sm' onClick={clearSelection}>
            Dismiss
          </Button>
        </div>
      ) : null}
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
        basePath={basePath}
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
        pageSize={pageSize}
        itemCount={clients.length}
      />
      <ClientSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        client={selectedClient}
      />
    </div>
  )
}

