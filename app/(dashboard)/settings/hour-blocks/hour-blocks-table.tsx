'use client'

import { FormEvent, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import {
  useHourBlocksTableState,
} from '@/lib/settings/hour-blocks/use-hour-blocks-table-state'
import type { PageInfo } from '@/lib/pagination/cursor'

import { HourBlocksTableSection } from './_components/hour-blocks-table-section'
import { HourBlockSheet } from './hour-block-sheet'

type Props = {
  hourBlocks: HourBlockWithClient[]
  clients: ClientRow[]
  tab: HourBlocksTab
  searchQuery: string
  pageInfo: PageInfo
  totalCount: number
}

const HourBlocksActivityFeed = dynamic(
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

export function HourBlocksSettingsTable({
  hourBlocks,
  clients,
  tab,
  searchQuery,
  pageInfo,
  totalCount,
}: Props) {
  const {
    sheetOpen,
    selectedBlock,
    sortedClients,
    createDisabled,
    createDisabledReason,
    pendingReason,
    openCreate,
    openEdit,
    handleSheetOpenChange,
    handleComplete,
    deleteDialog,
    destroyDialog,
    isPending,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    handleRequestDelete,
    handleRestore,
    handleRequestDestroy,
  } = useHourBlocksTableState({ clients })
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchQuery)

  useEffect(() => {
    setSearchValue(searchQuery)
  }, [searchQuery])

  const showListViews = tab !== 'activity'

  const handleTabSelect = (value: HourBlocksTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'hour-blocks') {
      params.delete('tab')
    } else {
      params.set('tab', value)
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
  const hasNextPage = pageInfo.hasNextPage && !paginationDisabled
  const hasPreviousPage = pageInfo.hasPreviousPage && !paginationDisabled

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={deleteDialog.open}
        title='Archive hour block?'
        description='Archiving this block hides it from active tracking while retaining historical activity.'
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={deleteDialog.onCancel}
        onConfirm={deleteDialog.onConfirm}
      />
      <ConfirmDialog
        open={destroyDialog.open}
        title='Permanently delete hour block?'
        description='This action removes the hour block forever. Make sure no other records depend on it.'
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={destroyDialog.onCancel}
        onConfirm={destroyDialog.onConfirm}
      />
      <Tabs
        value={tab}
        onValueChange={value => handleTabSelect(value as HourBlocksTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='hour-blocks'>Hour Blocks</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {tab === 'hour-blocks' ? (
            <DisabledFieldTooltip
              disabled={createDisabled}
              reason={createDisabledReason}
            >
              <Button onClick={openCreate} disabled={createDisabled}>
                <Plus className='h-4 w-4' /> Add hour block
              </Button>
            </DisabledFieldTooltip>
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
              placeholder='Search hour blocks…'
              className='max-w-xs'
              aria-label='Search hour blocks'
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
              Total hour blocks: {totalCount}
            </div>
          </form>
        ) : null}
        <TabsContent value='hour-blocks' className='space-y-6'>
          {tab === 'hour-blocks' ? (
            <>
              <HourBlocksTableSection
                hourBlocks={hourBlocks}
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
                emptyMessage='No hour blocks recorded yet. Log a retainer or client block to monitor it here.'
              />
              <PaginationControls
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
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
              <HourBlocksTableSection
                hourBlocks={hourBlocks}
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
                emptyMessage='Archive is empty. Archived hour blocks appear here after deletion.'
              />
              <PaginationControls
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
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
                Audit hour block creation, edits, archives, and deletions in one
                place.
              </p>
            </div>
            <HourBlocksActivityFeed
              targetType='HOUR_BLOCK'
              pageSize={20}
              emptyState='No recent hour block activity.'
              requireContext={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      <HourBlockSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleComplete}
        hourBlock={selectedBlock}
        clients={sortedClients}
      />
    </div>
  )
}

type HourBlocksTab = 'hour-blocks' | 'archive' | 'activity'

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
