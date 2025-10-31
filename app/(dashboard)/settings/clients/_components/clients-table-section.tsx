'use client'

import { Archive, Building2, Pencil, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { cn } from '@/lib/utils'
import { getStatusBadgeToken } from '@/lib/constants'
import type { ClientsTableClient } from '@/lib/settings/clients/use-clients-table-state'

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
}

export function ClientsTableSection({
  clients,
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
}: ClientsTableSectionProps) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Active projects</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => {
            const activeProjects = (client.projects ?? []).filter(project => {
              if (project.deleted_at) {
                return false
              }

              const status = (project.status ?? '').toLowerCase()
              return status === 'active'
            }).length

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

            const editDisabled = isDeleting || isRestoring || isDestroying
            const editDisabledReason = editDisabled ? pendingReason : null

            const showEdit = mode === 'active'
            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            return (
              <TableRow
                key={client.id}
                className={client.deleted_at ? 'opacity-60' : undefined}
              >
                <TableCell>
                  <div className='flex items-center gap-2'>
                    <Building2 className='text-muted-foreground h-4 w-4' />
                    <span className='font-medium'>{client.name}</span>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {client.slug ?? '—'}
                </TableCell>
                <TableCell className='text-sm'>{activeProjects}</TableCell>
                <TableCell>
                  <Badge
                    className={cn('text-xs', getStatusBadgeToken(statusTone))}
                  >
                    {statusLabel}
                  </Badge>
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
                          onClick={() => onEdit(client)}
                          title='Edit client'
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
                          size='icon'
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
                          size='icon'
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
