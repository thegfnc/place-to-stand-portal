'use client'

import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import {
  useHourBlocksTableState,
  type HourBlocksTab,
} from '@/lib/settings/hour-blocks/use-hour-blocks-table-state'

import { HourBlocksTableSection } from './_components/hour-blocks-table-section'
import { HourBlockSheet } from './hour-block-sheet'

type Props = {
  hourBlocks: HourBlockWithClient[]
  clients: ClientRow[]
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

export function HourBlocksSettingsTable({ hourBlocks, clients }: Props) {
  const {
    sheetOpen,
    selectedBlock,
    activeBlocks,
    archivedBlocks,
    sortedClients,
    createDisabled,
    createDisabledReason,
    pendingReason,
    openCreate,
    openEdit,
    handleSheetOpenChange,
    handleComplete,
    activeTab,
    handleTabChange,
    deleteDialog,
    destroyDialog,
    isPending,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    handleRequestDelete,
    handleRestore,
    handleRequestDestroy,
  } = useHourBlocksTableState({ hourBlocks, clients })

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
        value={activeTab}
        onValueChange={value => handleTabChange(value as HourBlocksTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='hour-blocks'>Hour Blocks</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {activeTab === 'hour-blocks' ? (
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
        <TabsContent value='hour-blocks' className='space-y-6'>
          <HourBlocksTableSection
            hourBlocks={activeBlocks}
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
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          <HourBlocksTableSection
            hourBlocks={archivedBlocks}
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
