'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useListParams } from '@/hooks/use-list-params'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import type { ArchivedLead } from '@/lib/data/leads'
import type { LeadAssigneeOption } from '@/lib/leads/types'
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { parseSortParam } from '@/lib/pagination/sort'
import { restoreLead, destroyLead } from '../_actions'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { cn } from '@/lib/utils'
import { FullWidthCell } from '@/components/table-toolbar/full-width-cell'
import { LeadSheet } from './lead-sheet'

type LeadsArchiveSectionProps = {
  leads: ArchivedLead[]
  assignees: LeadAssigneeOption[]
  senderName: string
  /** True when the `?lead=` share link points at a lead that no longer exists. */
  leadNotFound?: boolean
}

// PRD 004 §03: per-view sort allowlist (D6). The table is in-memory, so the
// parsed `?sort=` drives a client-side sort of the fetched array.
const LEAD_ARCHIVE_SORT_FIELDS = ['name', 'archived'] as const

const DEFAULT_LEAD_ARCHIVE_SORT = {
  field: 'archived',
  direction: 'desc',
} as const

function isLeadStatus(value: string | undefined): value is LeadStatusValue {
  return (
    typeof value === 'string' &&
    (LEAD_STATUS_VALUES as readonly string[]).includes(value)
  )
}

function isLeadArchiveSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (LEAD_ARCHIVE_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

export function LeadsArchiveSection({
  leads,
  assignees,
  senderName,
  leadNotFound = false,
}: LeadsArchiveSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { update, getParam, hasActiveFilters, reset } = useListParams({
    basePath: '/leads/archive',
    resetKeys: [],
    filters: {
      status: { isValid: value => isLeadStatus(value) },
      q: {},
    },
  })
  const [isPending, startTransition] = useTransition()
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [destroyTarget, setDestroyTarget] = useState<ArchivedLead | null>(null)
  // `?lead=` drives selection so archived leads are deep-linkable too.
  const { selectedId, select, clear } = useSheetParamSelection('lead')

  // Re-resolve from fresh props so the sheet reflects server refreshes.
  const selectedLead = selectedId
    ? (leads.find(lead => lead.id === selectedId) ?? null)
    : null

  // Keep the last-selected lead rendered after close so the sheet's exit
  // animation can play; only `open` toggles.
  const [lastOpenedLead, setLastOpenedLead] = useState<ArchivedLead | null>(
    null
  )
  if (selectedLead && selectedLead !== lastOpenedLead) {
    setLastOpenedLead(selectedLead)
  }
  const sheetOpen = Boolean(selectedLead)
  const sheetLead = selectedLead ?? lastOpenedLead

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      clear()
    }
  }

  const handleSheetSuccess = () => {
    clear()
    router.refresh()
  }

  const handleRestore = (lead: ArchivedLead) => {
    setPendingRestoreId(lead.id)
    startTransition(async () => {
      const result = await restoreLead({ leadId: lead.id })
      setPendingRestoreId(null)

      if (!result.success) {
        toast({
          title: 'Failed to restore lead',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Lead restored',
        description: `${lead.contactName} has been restored to the board.`,
      })
      router.refresh()
    })
  }

  const handleRequestDestroy = (lead: ArchivedLead) => {
    setDestroyTarget(lead)
  }

  const handleCancelDestroy = () => {
    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget) return

    const lead = destroyTarget
    setPendingDestroyId(lead.id)
    setDestroyTarget(null)

    startTransition(async () => {
      const result = await destroyLead({ leadId: lead.id })
      setPendingDestroyId(null)

      if (!result.success) {
        toast({
          title: 'Failed to delete lead',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Lead permanently deleted',
        description: `${lead.contactName} has been permanently removed.`,
      })
      // Drop a `?lead=` pointing at the destroyed row so the refresh doesn't
      // resolve it into a not-found notice.
      if (selectedId === lead.id) {
        clear()
      }
      router.refresh()
    })
  }

  const rawStatus = getParam('status')
  const statusFilter = isLeadStatus(rawStatus) ? rawStatus : undefined
  const searchQuery = getParam('q')?.trim() || undefined
  const rawSort = getParam('sort')
  const sortParam = rawSort && isLeadArchiveSortValue(rawSort) ? rawSort : undefined
  const sort = parseSortParam(
    sortParam,
    LEAD_ARCHIVE_SORT_FIELDS,
    DEFAULT_LEAD_ARCHIVE_SORT
  )

  // Only offer statuses actually present in the archive — leads keep their
  // last board status when archived, so any status can appear here.
  const statusOptions = useMemo(() => {
    const present = new Set(leads.map(lead => lead.status))
    return LEAD_STATUS_VALUES.filter(value => present.has(value)).map(
      value => ({ value, label: LEAD_STATUS_LABELS[value] })
    )
  }, [leads])

  const visibleLeads = useMemo(() => {
    let filtered = statusFilter
      ? leads.filter(lead => lead.status === statusFilter)
      : leads
    // In-memory `?q=` search over the fields the table shows (PRD 004 §03).
    if (searchQuery) {
      const needle = searchQuery.toLowerCase()
      filtered = filtered.filter(lead =>
        [lead.contactName, lead.companyName, lead.contactEmail].some(field =>
          field?.toLowerCase().includes(needle)
        )
      )
    }
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sort.field === 'name') {
        return (
          factor *
          a.contactName.localeCompare(b.contactName, undefined, {
            sensitivity: 'base',
          })
        )
      }
      return factor * a.deletedAt.localeCompare(b.deletedAt)
    })
  }, [leads, searchQuery, sort.direction, sort.field, statusFilter])

  if (leads.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
        No archived leads. Leads will appear here when archived from the board.
      </div>
    )
  }

  return (
    <>
      {leadNotFound ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked lead could not be found. It may have been permanently
            deleted.
          </span>
          <Button variant='ghost' size='sm' onClick={clear}>
            Dismiss
          </Button>
        </div>
      ) : null}
      {sheetLead ? (
        <LeadSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          lead={sheetLead}
          assignees={assignees}
          canManage
          senderName={senderName}
          onSuccess={handleSheetSuccess}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete lead?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.contactName} removes this lead and all associated data. This action cannot be undone.`
            : 'Permanently deleting this lead removes it. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <FilterBar>
        <SearchInput
          value={searchQuery}
          onCommit={value => update({ q: value })}
          placeholder='Search leads…'
        />
        <FilterSelect
          value={statusFilter}
          onChange={value => update({ status: value })}
          placeholder='All statuses'
          options={statusOptions}
        />
        <ResetFiltersButton show={hasActiveFilters} onReset={reset} />
      </FilterBar>
      <div className='rounded-lg border'>
        <Table density='compact' layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sortParam}
                defaultSort='archived:desc'
                onSortChange={next => update({ sort: next })}
              >
                Contact
              </SortableTableHead>
              <TableHead className='hidden md:table-cell'>Company</TableHead>
              <TableHead className='hidden xl:table-cell'>Email</TableHead>
              <TableHead className='w-40'>Last Status</TableHead>
              <SortableTableHead
                field='archived'
                sort={sortParam}
                defaultSort='archived:desc'
                onSortChange={next => update({ sort: next })}
                className='hidden w-40 md:table-cell'
              >
                Archived
              </SortableTableHead>
              <TableHead className='w-24 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLeads.map(lead => {
              const isRestoring = isPending && pendingRestoreId === lead.id
              const isDestroying = isPending && pendingDestroyId === lead.id
              const rowDisabled = isRestoring || isDestroying

              const statusLabel = lead.status
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())

              return (
                <TableRow
                  key={lead.id}
                  {...getClickableRowProps(() => {
                    select(lead.id)
                  })}
                  className={cn(CLICKABLE_ROW_CLASS, ARCHIVED_ROW_CLASS)}
                >
                  <TableCell className='truncate font-medium'>
                    {lead.contactName}
                  </TableCell>
                  <TableCell className='hidden truncate md:table-cell'>
                    {lead.companyName ?? (
                      <span className='text-muted-foreground/40'>—</span>
                    )}
                  </TableCell>
                  <TableCell className='hidden truncate xl:table-cell'>
                    {lead.contactEmail ? (
                      <span className='text-muted-foreground text-sm'>
                        {lead.contactEmail}
                      </span>
                    ) : (
                      <span className='text-muted-foreground/40'>—</span>
                    )}
                  </TableCell>
                  <TableCell className='truncate'>
                    <span className='text-muted-foreground text-sm'>
                      {statusLabel}
                    </span>
                  </TableCell>
                  <TableCell className='hidden md:table-cell'>
                    <span className='text-muted-foreground text-sm'>
                      {formatDistanceToNow(new Date(lead.deletedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='outline'
                        size='icon-sm'
                        onClick={() => handleRestore(lead)}
                        disabled={rowDisabled}
                        title='Restore lead'
                        aria-label={`Restore ${lead.contactName}`}
                      >
                        <RefreshCw className='h-4 w-4' />
                        <span className='sr-only'>Restore</span>
                      </Button>
                      <Button
                        variant='destructive'
                        size='icon-sm'
                        onClick={() => handleRequestDestroy(lead)}
                        disabled={rowDisabled}
                        title='Permanently delete lead'
                        aria-label={`Permanently delete ${lead.contactName}`}
                      >
                        <Trash2 className='h-4 w-4' />
                        <span className='sr-only'>Delete permanently</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {visibleLeads.length === 0 ? (
              <TableRow>
                <FullWidthCell
                  counts={{ base: 3, md: 5, xl: 6 }}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  No archived leads match the current filters.
                </FullWidthCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
