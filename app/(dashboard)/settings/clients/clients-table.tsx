'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { PageInfo } from '@/lib/pagination/cursor'
import type { ClientUserSummary } from '@/lib/settings/clients/client-sheet-utils'
import {
  type ClientsTab,
  type ClientsTableClient,
  useClientsTableState,
} from '@/lib/settings/clients/use-clients-table-state'

import { ClientsTableSection } from './_components/clients-table-section'
import { ClientSheet } from './clients-sheet'

type Props = {
  clients: ClientsTableClient[]
  clientUsers: ClientUserSummary[]
  membersByClient: Record<string, ClientUserSummary[]>
  tab: ClientsTab
  searchQuery: string
  pageInfo: PageInfo
  totalCount: number
}

const ClientsActivityFeed = dynamic(
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

export function ClientsSettingsTable({
  clients,
  clientUsers,
  membersByClient,
  tab,
  searchQuery,
  pageInfo,
  totalCount,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchQuery)

  useEffect(() => {
    setSearchValue(searchQuery)
  }, [searchQuery])

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
    openCreate,
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

  const showListViews = tab !== 'activity'
  const activeMode: ClientsTab = tab
  const emptyMessage =
    tab === 'archive'
      ? 'No archived clients. Archived clients appear here once deleted.'
      : 'No clients yet. Create one to begin organizing projects.'

  const handleTabChange = (next: ClientsTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'clients') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    params.delete('cursor')
    params.delete('dir')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = searchValue.trim()
    if (trimmed) {
      params.set('q', trimmed)
    } else {
      params.delete('q')
    }
    params.delete('cursor')
    params.delete('dir')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleClearSearch = () => {
    if (!searchQuery) {
      return
    }
    setSearchValue('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
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
      <Tabs
        value={activeMode}
        onValueChange={value => handleTabChange(value as ClientsTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center gap-4'>
          <TabsList>
            <TabsTrigger value='clients'>Clients</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {tab === 'clients' ? (
            <Button onClick={openCreate}>
              <Plus className='h-4 w-4' /> Add client
            </Button>
          ) : null}
        </div>
        {showListViews ? (
          <form
            onSubmit={handleSearchSubmit}
            className='flex w-full flex-wrap items-center gap-2'
          >
            <Input
              value={searchValue}
              onChange={event => setSearchValue(event.target.value)}
              placeholder='Search by client name or slug…'
              className='max-w-xs'
              aria-label='Search clients'
            />
            <Button type='submit'>Search</Button>
            {searchQuery ? (
              <Button
                type='button'
                variant='ghost'
                onClick={handleClearSearch}
                disabled={isPending}
              >
                Clear
              </Button>
            ) : null}
            <div className='text-muted-foreground ml-auto text-sm'>
              Total clients: {totalCount}
            </div>
          </form>
        ) : null}
        <TabsContent value='clients' className='space-y-6'>
          {tab === 'clients' ? (
            <>
              <ClientsTableSection
                clients={clients}
                mode='active'
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
            </>
          ) : null}
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          {tab === 'archive' ? (
            <>
              <ClientsTableSection
                clients={clients}
                mode='archive'
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
            </>
          ) : null}
        </TabsContent>
        <TabsContent value='activity' className='space-y-3'>
          <div className='space-y-3 p-1'>
            <div>
              <h3 className='text-lg font-semibold'>Recent activity</h3>
              <p className='text-muted-foreground text-sm'>
                Review client creation, edits, archives, and restorations in one
                place.
              </p>
            </div>
            <ClientsActivityFeed
              targetType='CLIENT'
              pageSize={20}
              emptyState='No recent client activity.'
              requireContext={false}
            />
          </div>
        </TabsContent>
      </Tabs>
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
