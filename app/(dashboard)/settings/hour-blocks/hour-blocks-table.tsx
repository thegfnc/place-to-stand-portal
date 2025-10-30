'use client'

import { useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Building2, Pencil, Plus, RefreshCw, Trash, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'

import { HourBlockSheet } from './hour-block-sheet'
import {
  destroyHourBlock,
  restoreHourBlock,
  softDeleteHourBlock,
} from './actions'

type Props = {
  hourBlocks: HourBlockWithClient[]
  clients: ClientRow[]
}

type HourBlocksTab = 'hour-blocks' | 'archive' | 'activity'

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

function useHourBlockBuckets(hourBlocks: HourBlockWithClient[]) {
  return useMemo(() => {
    const sorted = [...hourBlocks].sort((a, b) => {
      const clientNameA = a.client?.name ?? ''
      const clientNameB = b.client?.name ?? ''

      if (clientNameA.toLocaleLowerCase() === clientNameB.toLocaleLowerCase()) {
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      }

      return clientNameA.localeCompare(clientNameB, undefined, {
        sensitivity: 'base',
      })
    })

    const active = sorted.filter(block => !block.deleted_at)
    const archived = sorted.filter(block => Boolean(block.deleted_at))

    return { active, archived }
  }, [hourBlocks])
}

function useSortedClients(clients: ClientRow[]) {
  return useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )
}

export function HourBlocksSettingsTable({ hourBlocks, clients }: Props) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedBlock, setSelectedBlock] =
    useState<HourBlockWithClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HourBlockWithClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] =
    useState<HourBlockWithClient | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<HourBlocksTab>('hour-blocks')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const { active: activeBlocks, archived: archivedBlocks } =
    useHourBlockBuckets(hourBlocks)
  const sortedClients = useSortedClients(clients)

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Create a client before logging hour blocks.'
    : null

  const pendingReason = 'Please wait for the current request to finish.'

  const openCreate = () => {
    setSelectedBlock(null)
    setSheetOpen(true)
  }

  const openEdit = (block: HourBlockWithClient) => {
    setSelectedBlock(block)
    setSheetOpen(true)
  }

  const handleClosed = () => {
    setSheetOpen(false)
    setSelectedBlock(null)
    router.refresh()
  }

  const handleRequestDelete = (block: HourBlockWithClient) => {
    if (block.deleted_at || isPending) {
      return
    }

    setDeleteTarget(block)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const block = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(block.id)

    startTransition(async () => {
      try {
        const result = await softDeleteHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block archived',
          description:
            'The hour block is hidden from active tracking but remains in history.',
        })
        router.refresh()
        setActiveTab('archive')
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (block: HourBlockWithClient) => {
    if (!block.deleted_at || isPending) {
      return
    }

    setPendingRestoreId(block.id)

    startTransition(async () => {
      try {
        const result = await restoreHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to restore hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block restored',
          description: 'The hour block is active again.',
        })
        router.refresh()
        setActiveTab('hour-blocks')
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (block: HourBlockWithClient) => {
    if (!block.deleted_at || isPending) {
      return
    }

    setDestroyTarget(block)
  }

  const handleCancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deleted_at) {
      setDestroyTarget(null)
      return
    }

    const block = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(block.id)

    startTransition(async () => {
      try {
        const result = await destroyHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block permanently deleted',
          description: 'The hour block has been removed.',
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive hour block?'
        description='Archiving this block hides it from active tracking while retaining historical activity.'
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete hour block?'
        description='This action removes the hour block forever. Make sure no other records depend on it.'
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as HourBlocksTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='hour-blocks'>Hour Blocks</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity Log</TabsTrigger>
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
          <div className='space-y-3 rounded-xl border p-4'>
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
        onOpenChange={open => {
          setSheetOpen(open)
          if (!open) {
            setSelectedBlock(null)
          }
        }}
        onComplete={handleClosed}
        hourBlock={selectedBlock}
        clients={sortedClients}
      />
    </div>
  )
}

type HourBlocksTableSectionProps = {
  hourBlocks: HourBlockWithClient[]
  mode: 'active' | 'archive'
  onEdit: (block: HourBlockWithClient) => void
  onRequestDelete: (block: HourBlockWithClient) => void
  onRestore: (block: HourBlockWithClient) => void
  onRequestDestroy: (block: HourBlockWithClient) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
}

function HourBlocksTableSection({
  hourBlocks,
  mode,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  emptyMessage,
}: HourBlocksTableSectionProps) {
  const toHours = (value: number) => `${value.toLocaleString()}h`
  const formatTimestamp = (value: string) => {
    try {
      return format(new Date(value), 'MMM d, yyyy')
    } catch (error) {
      console.warn('Unable to format hour block timestamp', { value, error })
      return '—'
    }
  }

  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Client</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>Hours purchased</TableHead>
            <TableHead>Created on</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hourBlocks.map(block => {
            const client = block.client
            const invoiceNumber =
              block.invoice_number && block.invoice_number.length > 0
                ? block.invoice_number
                : '—'
            const isArchived = Boolean(block.deleted_at)
            const isDeleting = isPending && pendingDeleteId === block.id
            const isRestoring = isPending && pendingRestoreId === block.id
            const isDestroying = isPending && pendingDestroyId === block.id

            const showEdit = mode === 'active'
            const showArchive = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            const editDisabled = isDeleting || isRestoring || isDestroying
            const archiveDisabled =
              isDeleting || isRestoring || isDestroying || isArchived
            const restoreDisabled =
              isRestoring || isDeleting || isDestroying || !isArchived
            const destroyDisabled =
              isDestroying || isDeleting || isRestoring || !isArchived

            const archiveDisabledReason = archiveDisabled
              ? isArchived
                ? 'Hour block already archived.'
                : pendingReason
              : null

            const restoreDisabledReason = restoreDisabled
              ? isArchived
                ? pendingReason
                : 'Hour block is already active.'
              : null

            const destroyDisabledReason = destroyDisabled
              ? !isArchived
                ? 'Archive the hour block before permanently deleting.'
                : pendingReason
              : null

            const editDisabledReason = editDisabled ? pendingReason : null

            return (
              <TableRow
                key={block.id}
                className={isArchived ? 'opacity-60' : undefined}
              >
                <TableCell>
                  <div className='flex items-center gap-2 text-sm'>
                    <Building2 className='text-muted-foreground h-4 w-4' />
                    <span>{client ? client.name : 'Unassigned'}</span>
                  </div>
                  {client?.deleted_at ? (
                    <p className='text-destructive text-xs'>Client archived</p>
                  ) : null}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {invoiceNumber}
                </TableCell>
                <TableCell className='text-sm'>
                  {toHours(block.hours_purchased)}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {formatTimestamp(block.created_at)}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showEdit ? (
                      <DisabledFieldTooltip
                        disabled={editDisabled}
                        reason={editDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => onEdit(block)}
                          title='Edit hour block'
                          disabled={editDisabled}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='secondary'
                          size='icon'
                          onClick={() => onRestore(block)}
                          title='Restore hour block'
                          aria-label='Restore hour block'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showArchive ? (
                      <DisabledFieldTooltip
                        disabled={archiveDisabled}
                        reason={archiveDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDelete(block)}
                          title='Archive hour block'
                          aria-label='Archive hour block'
                          disabled={archiveDisabled}
                        >
                          <Trash2 className='h-4 w-4' />
                          <span className='sr-only'>Archive</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showDestroy ? (
                      <DisabledFieldTooltip
                        disabled={destroyDisabled}
                        reason={destroyDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDestroy(block)}
                          title='Permanently delete hour block'
                          aria-label='Permanently delete hour block'
                          disabled={destroyDisabled}
                        >
                          <Trash className='h-4 w-4' />
                          <span className='sr-only'>Delete permanently</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {hourBlocks.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
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
