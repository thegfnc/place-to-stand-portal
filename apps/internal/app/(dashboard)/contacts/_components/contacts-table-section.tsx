'use client'

import {
  Archive,
  Contact,
  Eye,
  Mail,
  Phone,
  RefreshCw,
  Trash2,
  UserPlus,
} from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { isContactSortValue } from '@/lib/settings/contacts/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'

import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'

import { LinkedClientsCell } from './linked-clients-cell'
import { cn } from '@/lib/utils'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import { FullWidthCell } from '@/components/table-toolbar/full-width-cell'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

/**
 * The one row action that creates something (a portal user) gets a pale
 * green tint so it scans apart from the neutral preview button and the
 * destructive archive button beside it — a warm tint read as another
 * destructive action.
 */
const PROMOTE_BUTTON_CLASS =
  'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500/60 hover:bg-emerald-500/20 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200'

export type ContactsTableSectionProps = {
  contacts: ContactsTableContact[]
  mode: 'active' | 'archive'
  onEdit: (contact: ContactsTableContact) => void
  onRequestDelete: (contact: ContactsTableContact) => void
  onRestore: (contact: ContactsTableContact) => void
  onRequestDestroy: (contact: ContactsTableContact) => void
  onRequestPromote: (contact: ContactsTableContact) => void
  onRequestPreview: (contact: ContactsTableContact) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

export function ContactsTableSection({
  contacts,
  mode,
  basePath,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  onRequestPromote,
  onRequestPreview,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  emptyMessage,
}: ContactsTableSectionProps) {
  // Contacts tables paginate by offset — `page` is the pagination key
  // cleared on sort changes (not cursor/dir).
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isContactSortValue(rawSort) ? rawSort : undefined

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
            <SortableTableHead
              field='email'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='hidden md:table-cell'
            >
              Email
            </SortableTableHead>
            <SortableTableHead
              field='phone'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='hidden w-[max(10rem,13%)] md:table-cell'
            >
              Phone
            </SortableTableHead>
            <SortableTableHead
              field='clients'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-[max(6rem,8%)]'
            >
              Clients
            </SortableTableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map(contact => {
            const isDeleting = isPending && pendingDeleteId === contact.id
            const isRestoring = isPending && pendingRestoreId === contact.id
            const isDestroying = isPending && pendingDestroyId === contact.id

            const deleteDisabled =
              isDeleting ||
              isRestoring ||
              isDestroying ||
              Boolean(contact.deletedAt)
            const deleteDisabledReason = deleteDisabled
              ? isDeleting || isRestoring || isDestroying
                ? pendingReason
                : contact.deletedAt
                  ? 'Contact already archived.'
                  : null
              : null

            const restoreDisabled = isRestoring || isDeleting || isDestroying
            const restoreDisabledReason = restoreDisabled ? pendingReason : null

            const destroyDisabled =
              isDestroying || isDeleting || isRestoring || !contact.deletedAt
            const destroyDisabledReason = destroyDisabled
              ? !contact.deletedAt
                ? 'Archive the contact before permanently deleting.'
                : pendingReason
              : null

            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'
            const showPreview = mode === 'active'
            const showPromote =
              mode === 'active' &&
              !contact.userId

            const promoteDisabled = isDeleting || isRestoring || isDestroying
            const promoteDisabledReason = promoteDisabled ? pendingReason : null

            return (
              <TableRow
                key={contact.id}
                {...getClickableRowProps(() => onEdit(contact))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  contact.deletedAt && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2'>
                    <Contact className='h-4 w-4 shrink-0 text-cyan-500' />
                    <span className='truncate font-medium'>{contact.name}</span>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground hidden text-sm md:table-cell'>
                  <a
                    href={`mailto:${contact.email}`}
                    className='hover:text-foreground inline-flex max-w-full items-center gap-1.5 transition'
                  >
                    <Mail className='h-3 w-3 shrink-0' />
                    <span className='truncate'>{contact.email}</span>
                  </a>
                </TableCell>
                <TableCell className='text-muted-foreground hidden text-sm md:table-cell'>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className='hover:text-foreground inline-flex items-center gap-1.5 transition'
                    >
                      <Phone className='h-3 w-3' />
                      {contact.phone}
                    </a>
                  ) : (
                    <span className='text-muted-foreground/50'>—</span>
                  )}
                </TableCell>
                <TableCell className='text-sm'>
                  <LinkedClientsCell clients={contact.metrics.clients} />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {/* Promote renders first: it's conditional, so keeping
                        Preview adjacent to Archive holds the eye icon to one
                        column across rows. */}
                    {showPromote ? (
                      <DisabledFieldTooltip
                        disabled={promoteDisabled}
                        reason={promoteDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon-sm'
                          onClick={() => onRequestPromote(contact)}
                          title='Create portal account'
                          aria-label='Create portal account'
                          disabled={promoteDisabled}
                          className={PROMOTE_BUTTON_CLASS}
                        >
                          <UserPlus className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showPreview ? (
                      <Button
                        variant='outline'
                        size='icon-sm'
                        onClick={e => {
                          e.stopPropagation()
                          onRequestPreview(contact)
                        }}
                        title='Preview in client portal'
                        aria-label='Preview in client portal'
                        disabled={isPending}
                      >
                        <Eye className='h-4 w-4' />
                      </Button>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon-sm'
                          onClick={() => onRestore(contact)}
                          title='Restore contact'
                          aria-label='Restore contact'
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
                          onClick={() => onRequestDelete(contact)}
                          title='Archive contact'
                          aria-label='Archive contact'
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
                          onClick={() => onRequestDestroy(contact)}
                          title='Permanently delete contact'
                          aria-label='Permanently delete contact'
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
          {contacts.length === 0 ? (
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
