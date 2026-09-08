'use client'

import Link from 'next/link'
import { Archive, Building2, Info, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { formatCalendarDate } from '@/lib/dates'
import { invoiceHref } from '@/lib/sheets/hrefs'
import { isHourBlockSortValue } from '@/lib/settings/hour-blocks/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import type { HourBlockWithClient } from '@/lib/settings/hour-blocks/hour-block-form'
import { cn } from '@/lib/utils'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

type HourBlocksTableMode = 'active' | 'archive'

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
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

const toHours = (value: number) => `${value.toLocaleString()}h`

const formatTimestamp = (value: string) => formatCalendarDate(value) ?? '—'

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
  basePath,
}: HourBlocksTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isHourBlockSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact' layout='fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead className='w-[34%]'>Client</TableHead>
            <TableHead className='w-[18%]'>Invoice #</TableHead>
            <TableHead className='w-[18%]'>Hours purchased</TableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
            >
              Created on
            </SortableTableHead>
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

            const showArchive = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

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

            return (
              <TableRow
                key={block.id}
                {...getClickableRowProps(() => onEdit(block))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  isArchived && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2 text-sm'>
                    <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
                    <span className='truncate'>{client ? client.name : 'Unassigned'}</span>
                  </div>
                  {client?.deleted_at ? (
                    <p className='text-destructive text-xs'>Client archived</p>
                  ) : null}
                </TableCell>
                <TableCell className='text-sm'>
                  {block.invoice_id && block.invoice_number ? (
                    <Link
                      href={invoiceHref(block.invoice_id)}
                      className='text-muted-foreground hover:text-foreground hover:underline'
                    >
                      {block.invoice_number}
                    </Link>
                  ) : (
                    <span className='text-muted-foreground'>{invoiceNumber}</span>
                  )}
                </TableCell>
                <TableCell className='text-sm'>
                  <span className='inline-flex items-center gap-1.5'>
                    {toHours(block.hours_purchased)}
                    {block.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className='cursor-default'
                            aria-label='Hour block notes'
                          >
                            <Info className='text-muted-foreground h-3.5 w-3.5' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className='max-w-xs whitespace-pre-wrap'>
                          {block.notes}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {formatTimestamp(block.created_at)}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon-sm'
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
                          size='icon-sm'
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
                          size='icon-sm'
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
