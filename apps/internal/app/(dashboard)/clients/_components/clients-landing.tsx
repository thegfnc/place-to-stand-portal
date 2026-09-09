'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Archive, Building2, CheckCircle2, Clock, Pencil } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useListParams } from '@/hooks/use-list-params'
import type { ClientWithMetrics } from '@/lib/data/clients'
import { getBillingTypeOption } from '@/lib/settings/clients/billing-types'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { isClientLandingSortValue } from '@/lib/settings/clients/filters'
import {
  type ClientsTableClient,
  useClientsTableState,
} from '@/lib/settings/clients/use-clients-table-state'
import { cn } from '@/lib/utils'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { ActiveProjectsCell } from './active-projects-cell'
import { ClientSheet } from './clients-sheet'
import { LinkedContactsCell } from './linked-contacts-cell'

type ClientsLandingProps = {
  clients: ClientWithMetrics[]
  /**
   * Row resolved server-side from `?client=<id>`. The landing list is
   * filtered, so a shared link can point at a client it doesn't render.
   */
  deepLinkedClient?: ClientRow | null
  /** True when `?client=` points at a client that no longer exists. */
  clientNotFound?: boolean
  currentPage: number
  totalPages: number
  pageSize: number
  /** Filtered total across every page (the footer's `of N`). */
  totalCount: number
}

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(hours: number): string {
  return HOURS_FORMATTER.format(hours)
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * The landing query returns camelCase metric rows; the sheet/table state
 * machine speaks the snake_case `ClientRow` twin. `created_by` is the one
 * field the metrics query doesn't select — nothing in the sheet reads it.
 */
function toTableClient(client: ClientWithMetrics): ClientsTableClient {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    website: client.website,
    state: client.state,
    origination_contact_id: client.originationContactId,
    origination_user_id: client.originationUserId,
    closer_user_id: client.closerUserId,
    billing_type: client.billingType,
    created_by: null,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
    metrics: {
      active_projects: client.activeProjectCount,
      total_projects: client.projectCount,
    },
  }
}

export function ClientsLanding({
  clients,
  deepLinkedClient = null,
  clientNotFound = false,
  currentPage,
  totalPages,
  pageSize,
  totalCount,
}: ClientsLandingProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { update, getParam } = useListParams({
    basePath: '/clients',
    resetKeys: ['cursor', 'dir', 'page'],
  })

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(page))
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const rawSort = getParam('sort')
  const sort =
    rawSort && isClientLandingSortValue(rawSort) ? rawSort : undefined
  // Guard-validated active search (R4): an empty list under a live `?q=`
  // shows the filtered message, not the default empty state.
  const hasActiveFilter = Boolean(getParam('q')?.trim())

  const tableClients = useMemo(() => clients.map(toTableClient), [clients])

  // `/clients` is the canonical host page for `?client=` — the landing rows
  // link into the client workspace, so the sheet opens via the Edit action
  // (or a share link / the Add client button), never plain row click.
  const {
    sheetOpen,
    selectedClient,
    deleteTarget,
    isPending,
    pendingReason,
    openEdit,
    clearSelection: clear,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useClientsTableState({ clients: tableClients, deepLinkedClient })

  const sheet = (
    <>
      {clientNotFound ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked client could not be found. It may have been permanently
            deleted.
          </span>
          <Button variant='ghost' size='sm' onClick={clear}>
            Dismiss
          </Button>
        </div>
      ) : null}
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
      <ClientSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        client={selectedClient}
      />
    </>
  )

  if (clients.length === 0) {
    return (
      <>
        {sheet}
        <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>No clients found</h2>
            <p className='text-muted-foreground text-sm'>
              {hasActiveFilter
                ? 'No clients match the current filters.'
                : 'Clients will appear here once they are created.'}
            </p>
          </div>
        </div>
      </>
    )
  }

  const getClientHref = (client: ClientWithMetrics) => {
    return client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
  }

  return (
    <>
      {sheet}
      <div className='rounded-lg border'>
        <Table density='compact' layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
              >
                Client
              </SortableTableHead>
              <SortableTableHead
                field='billing'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-24'
              >
                Billing
              </SortableTableHead>
              {/* Ordered by active project count — the number the cell leads with. */}
              <SortableTableHead
                field='projects'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='hidden w-36 md:table-cell'
              >
                Projects
              </SortableTableHead>
              {/* Ordered by linked contact count — the number the cell shows. */}
              <SortableTableHead
                field='contacts'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='hidden w-20 xl:table-cell'
              >
                Contacts
              </SortableTableHead>
              {/* Ordered by hours remaining; net_30 rows have none and sort last. */}
              <SortableTableHead
                field='hours'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='hidden w-48 md:table-cell'
              >
                Hours
              </SortableTableHead>
              <SortableTableHead
                field='origination'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                align='center'
                className='hidden w-24 xl:table-cell'
              >
                Origination
              </SortableTableHead>
              <SortableTableHead
                field='closer'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                align='center'
                className='hidden w-20 xl:table-cell'
              >
                Closer
              </SortableTableHead>
              <TableHead className='w-24 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, index) => (
              <TableRow
                key={client.id}
                {...getClickableRowProps(() =>
                  router.push(getClientHref(client))
                )}
                className={CLICKABLE_ROW_CLASS}
              >
                <TableCell>
                  <Link
                    href={getClientHref(client)}
                    className='flex min-w-0 items-center gap-2 py-1'
                  >
                    <Building2 className='h-4 w-4 shrink-0 text-blue-500' />
                    <span className='truncate font-medium'>{client.name}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  {(() => {
                    const billingOption = getBillingTypeOption(
                      client.billingType
                    )
                    return (
                      <Badge
                        variant='outline'
                        className={cn('text-xs', billingOption?.badgeClassName)}
                      >
                        {billingOption?.label ?? client.billingType}
                      </Badge>
                    )
                  })()}
                </TableCell>
                <TableCell className='hidden md:table-cell'>
                  <ActiveProjectsCell
                    projects={client.activeProjects}
                    allProjects={client.allProjects}
                    clientSlug={client.slug}
                    clientId={client.id}
                    totalProjectCount={client.projectCount}
                  />
                </TableCell>
                <TableCell className='hidden xl:table-cell'>
                  <LinkedContactsCell contacts={client.contacts} />
                </TableCell>
                <TableCell className='hidden md:table-cell'>
                  {client.billingType === 'prepaid' ? (
                    <div className='flex items-center gap-2 text-sm'>
                      <Clock
                        className={cn(
                          'h-4 w-4',
                          client.hoursRemaining > 0
                            ? 'text-emerald-600'
                            : client.hoursRemaining === 0
                              ? 'text-muted-foreground'
                              : 'text-red-600'
                        )}
                      />
                      <span
                        className={cn(
                          client.hoursRemaining > 0
                            ? 'font-medium text-emerald-600'
                            : client.hoursRemaining === 0
                              ? 'text-muted-foreground'
                              : 'font-medium text-red-600'
                        )}
                      >
                        {formatHours(client.hoursRemaining)} remaining
                      </span>
                      <span className='text-muted-foreground/60'>
                        ({formatHours(client.totalHoursPurchased)} total)
                      </span>
                    </div>
                  ) : (
                    <span className='text-muted-foreground/40 text-sm'>—</span>
                  )}
                </TableCell>
                <TableCell className='hidden xl:table-cell'>
                  <div className='flex items-center justify-center'>
                    {client.originationUserId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className='h-6 w-6'>
                            <AvatarImage
                              src={`/api/storage/user-avatar/${client.originationUserId}?v=${encodeURIComponent(client.originationUserUpdatedAt ?? '')}`}
                              alt={
                                client.originationUserName ?? 'Internal partner'
                              }
                            />
                            <AvatarFallback className='text-[9px]'>
                              {getInitials(client.originationUserName)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          Internal — {client.originationUserName ?? 'partner'}
                        </TooltipContent>
                      </Tooltip>
                    ) : client.originationContactId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='cursor-default'>
                            <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          External —{' '}
                          {client.originationContactName ?? 'referrer'}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className='text-muted-foreground/40 text-sm'>
                        —
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className='hidden xl:table-cell'>
                  <div className='flex items-center justify-center'>
                    {client.closerUserId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className='h-6 w-6'>
                            <AvatarImage
                              src={`/api/storage/user-avatar/${client.closerUserId}?v=${encodeURIComponent(client.closerUserUpdatedAt ?? '')}`}
                              alt={client.closerUserName ?? 'Closer'}
                            />
                            <AvatarFallback className='text-[9px]'>
                              {getInitials(client.closerUserName)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          {client.closerUserName ?? 'Closer'}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className='text-muted-foreground/40 text-sm'>
                        —
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    <Button
                      variant='outline'
                      size='icon-sm'
                      onClick={() => openEdit(tableClients[index])}
                      title='Edit client'
                      aria-label='Edit client'
                      disabled={isPending}
                    >
                      <Pencil className='h-4 w-4' />
                      <span className='sr-only'>Edit</span>
                    </Button>
                    <DisabledFieldTooltip
                      disabled={isPending}
                      reason={isPending ? pendingReason : null}
                    >
                      <Button
                        variant='destructive'
                        size='icon-sm'
                        onClick={() => handleRequestDelete(tableClients[index])}
                        title='Archive client'
                        aria-label='Archive client'
                        disabled={isPending}
                      >
                        <Archive className='h-4 w-4' />
                        <span className='sr-only'>Archive</span>
                      </Button>
                    </DisabledFieldTooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        mode='paged'
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
    </>
  )
}
