'use client'

import { Archive, Building2, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Badge } from '@/components/ui/badge'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { isClientSortValue } from '@/lib/settings/clients/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'

import { cn } from '@/lib/utils'
import { getStatusBadgeToken } from '@/lib/constants'
import type { ClientsTableClient } from '@/lib/settings/clients/use-clients-table-state'
import {
  CLIENT_BILLING_TYPE_SELECT_OPTIONS,
  type ClientBillingTypeValue,
} from '@/lib/settings/clients/billing-types'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import { FullWidthCell } from '@/components/table-toolbar/full-width-cell'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

const BILLING_TYPE_LABELS = CLIENT_BILLING_TYPE_SELECT_OPTIONS.reduce<
  Record<ClientBillingTypeValue, string>
>((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {} as Record<ClientBillingTypeValue, string>)

export type ClientsTableSectionProps = {
  clients: ClientsTableClient[]
  mode: 'active' | 'archive'
  onEdit: (client: ClientsTableClient) => void
  onRequestDelete: (client: ClientsTableClient) => void
  onRestore: (client: ClientsTableClient) => void
  onRequestDestroy: (client: ClientsTableClient) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

export function ClientsTableSection({
  clients,
  mode,
  basePath,
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
}: ClientsTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['cursor', 'dir'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isClientSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact' layout='fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='name'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
            >
              Name
            </SortableTableHead>
            <TableHead className='hidden w-28 md:table-cell'>
              Billing type
            </TableHead>
            <TableHead className='hidden w-32 md:table-cell'>
              Active projects
            </TableHead>
            <TableHead className='w-24'>Status</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => {
            const activeProjects = client.metrics?.active_projects ?? 0

            const statusLabel = client.deleted_at ? 'Archived' : 'Active'
            const statusTone = client.deleted_at ? 'archived' : 'active'

            const isDeleting = isPending && pendingDeleteId === client.id
            const isRestoring = isPending && pendingRestoreId === client.id
            const isDestroying = isPending && pendingDestroyId === client.id

            const deleteDisabled =
              isDeleting ||
              isRestoring ||
              isDestroying ||
              Boolean(client.deleted_at)
            const deleteDisabledReason = deleteDisabled
              ? isDeleting || isRestoring || isDestroying
                ? pendingReason
                : client.deleted_at
                  ? 'Client already archived.'
                  : null
              : null

            const restoreDisabled = isRestoring || isDeleting || isDestroying
            const restoreDisabledReason = restoreDisabled ? pendingReason : null

            const destroyDisabled =
              isDestroying || isDeleting || isRestoring || !client.deleted_at
            const destroyDisabledReason = destroyDisabled
              ? !client.deleted_at
                ? 'Archive the client before permanently deleting.'
                : pendingReason
              : null

            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            return (
              <TableRow
                key={client.id}
                {...getClickableRowProps(() => onEdit(client))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  client.deleted_at && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2'>
                    <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
                    <span className='truncate font-medium'>{client.name}</span>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground hidden text-sm md:table-cell'>
                  {BILLING_TYPE_LABELS[client.billing_type] ?? '—'}
                </TableCell>
                <TableCell className='hidden text-sm md:table-cell'>
                  {activeProjects}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn('text-xs', getStatusBadgeToken(statusTone))}
                  >
                    {statusLabel}
                  </Badge>
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
                          onClick={() => onRestore(client)}
                          title='Restore client'
                          aria-label='Restore client'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showSoftDelete ? (
                      <DisabledFieldTooltip
                        disabled={deleteDisabled}
                        reason={deleteDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon-sm'
                          onClick={() => onRequestDelete(client)}
                          title='Delete client'
                          aria-label='Delete client'
                          disabled={deleteDisabled}
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
                          onClick={() => onRequestDestroy(client)}
                          title='Permanently delete client'
                          aria-label='Permanently delete client'
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
          {clients.length === 0 ? (
            <TableRow>
              <FullWidthCell
                counts={{ base: 3, md: 5 }}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </FullWidthCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
