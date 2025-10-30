import { format } from 'date-fns'
import { Archive, Building2, Pencil, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { HourBlockWithClient } from '@/lib/settings/hour-blocks/hour-block-form'

export type HourBlocksTableMode = 'active' | 'archive'

export type HourBlocksTableSectionProps = {
  hourBlocks: HourBlockWithClient[]
  mode: HourBlocksTableMode
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  onEdit: (block: HourBlockWithClient) => void
  onRequestDelete: (block: HourBlockWithClient) => void
  onRestore: (block: HourBlockWithClient) => void
  onRequestDestroy: (block: HourBlockWithClient) => void
  emptyMessage: string
}

const toHours = (value: number) => `${value.toLocaleString()}h`

const formatTimestamp = (value: string) => {
  try {
    return format(new Date(value), 'MMM d, yyyy')
  } catch (error) {
    console.warn('Unable to format hour block timestamp', { value, error })
    return '—'
  }
}

export function HourBlocksTableSection({
  hourBlocks,
  mode,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  emptyMessage,
}: HourBlocksTableSectionProps) {
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
                          <Archive className='h-4 w-4' />
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
                          <Trash2 className='h-4 w-4' />
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
