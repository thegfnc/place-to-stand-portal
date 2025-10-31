'use client'

import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
}: Props) {
  const {
    activeClients,
    archivedClients,
    activeTab,
    setActiveTab,
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
  } = useClientsTableState({ clients })

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
        value={activeTab}
        onValueChange={value => setActiveTab(value as ClientsTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='clients'>Clients</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {activeTab === 'clients' ? (
            <Button onClick={openCreate}>
              <Plus className='h-4 w-4' /> Add client
            </Button>
          ) : null}
        </div>
        <TabsContent value='clients' className='space-y-6'>
          <ClientsTableSection
            clients={activeClients}
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
            emptyMessage='No clients yet. Create one to begin organizing projects.'
          />
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          <ClientsTableSection
            clients={archivedClients}
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
            emptyMessage='No archived clients. Archived clients appear here once deleted.'
          />
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
