'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Archive, Check, RefreshCw, Trash2 } from 'lucide-react'

import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Progress } from '@pts/ui/progress'
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
import { cn } from '@/lib/utils'
import {
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_KIND_TOKENS,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_TOKENS,
  isFormSubmissionKind,
  isFormSubmissionStatus,
  isUnacknowledgedSubmission,
} from '@/lib/form-submissions/constants'
import { isSubmissionSortValue } from '@/lib/form-submissions/filters'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'
import {
  acknowledgeSubmission,
  archiveSubmission,
  destroySubmission,
  restoreSubmission,
} from '../actions'

import { SubmissionArchiveDialog } from './submission-archive-dialog'
import { SubmissionDetailSheet } from './submission-detail-sheet'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

type SubmissionsTableMode = 'active' | 'archive'

const EMPTY_STATE_COPY: Record<SubmissionsTableMode, string> = {
  active: 'No submissions yet.',
  archive: 'No archived submissions.',
}

function describeSubmission(submission: FormSubmissionRecord): string {
  return (
    submission.contactName ||
    submission.contactEmail ||
    'this anonymous submission'
  )
}

type SubmissionsTableProps = {
  submissions: FormSubmissionRecord[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: SubmissionsTableMode
  /** Base path pagination pushes to — '/submissions' or '/submissions/archive'. */
  basePath: string
  /**
   * Row resolved server-side from the `?submission=` share link. May not be
   * in `submissions` when it sits on another page or is filtered out.
   */
  deepLinkedSubmission?: FormSubmissionRecord | null
  /** True when the `?submission=` share link points at a row that no longer exists. */
  deepLinkNotFound?: boolean
}

export function SubmissionsTable({
  submissions,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
  basePath,
  deepLinkedSubmission,
  deepLinkNotFound,
}: SubmissionsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  // Selection by id, derived from fresh props: after router.refresh() the
  // open sheet re-renders with the server's latest row instead of a stale
  // snapshot. The shared hook owns the `?submission=` mirroring — local state
  // keeps the sheet opening and closing instantly while the URL catches up,
  // and back/forward is adopted during render.
  const {
    selectedValue: submissionParam,
    selectedId,
    select: selectSubmission,
    clear: clearSubmission,
  } = useSheetParamSelection('submission')
  const selected =
    submissions.find(submission => submission.id === selectedId) ??
    (deepLinkedSubmission && deepLinkedSubmission.id === selectedId
      ? deepLinkedSubmission
      : null)
  const [archiveTarget, setArchiveTarget] =
    useState<FormSubmissionRecord | null>(null)
  const [destroyTarget, setDestroyTarget] =
    useState<FormSubmissionRecord | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // The archive tab shows when each row was archived; active mode doesn't.
  const columnCount = mode === 'archive' ? 10 : 9

  // Sort changes route through useListParams so they reset offset paging
  // (PRD 004 §03); row-selection and page pushes keep the local helper.
  const { update: updateListParams, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isSubmissionSortValue(rawSort) ? rawSort : undefined

  // Run raw params through the type guards (R4): ?kind=bogus is ignored by
  // the server, so it must not count as an active filter — an unfiltered
  // empty list would otherwise show the wrong message. The unacknowledged
  // quick filter only exists on the active tab.
  const hasActiveFilter =
    (searchParams.get('q') ?? '').trim().length > 0 ||
    isFormSubmissionKind(searchParams.get('kind') ?? undefined) ||
    isFormSubmissionStatus(searchParams.get('status') ?? undefined) ||
    (mode === 'active' && searchParams.get('unacknowledged') === '1')

  const emptyMessage = hasActiveFilter
    ? 'No submissions match the current filters.'
    : EMPTY_STATE_COPY[mode]

  const updateParams = useCallback(
    (
      updates: Record<string, string | undefined>,
      options?: { scroll?: boolean; replace?: boolean }
    ) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }

      const navigate = options?.replace ? router.replace : router.push
      navigate(`${basePath}?${next.toString()}`, {
        scroll: options?.scroll ?? true,
      })
    },
    [basePath, router, searchParams]
  )

  const handleSelect = useCallback(
    (id: string) => {
      selectSubmission(id)
    },
    [selectSubmission]
  )

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // `clear` closes locally, then replaces the URL (shared convention)
        // so Back doesn't reopen the sheet.
        clearSubmission()
      }
    },
    [clearSubmission]
  )

  // After an action removes the last row of a page > 1, plain refresh would
  // strand the user on an empty out-of-range page — step back instead.
  const refreshAfterAction = useCallback(
    (removesRow: boolean) => {
      if (removesRow && submissions.length === 1 && currentPage > 1) {
        const previousPage = currentPage - 1
        // Also drop the share-link param: `searchParams` may still carry it
        // (sheet-close navigation in flight), and re-pushing it would reopen
        // the sheet for the removed row.
        updateParams(
          {
            page: previousPage === 1 ? undefined : String(previousPage),
            submission: undefined,
          },
          { scroll: false }
        )
        return
      }

      router.refresh()
    },
    [currentPage, router, submissions.length, updateParams]
  )

  const runRowAction = useCallback(
    (
      submission: FormSubmissionRecord,
      run: () => Promise<{ error?: string }>,
      errorTitle: string,
      removesRow: boolean
    ) => {
      setPendingId(submission.id)
      startTransition(async () => {
        const result = await run()

        setPendingId(null)

        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
          })
          // The row may have changed underneath us — show the latest.
          router.refresh()
          return
        }

        refreshAfterAction(removesRow)
      })
    },
    [refreshAfterAction, router, toast]
  )

  const handleAcknowledge = useCallback(
    (submission: FormSubmissionRecord) =>
      runRowAction(
        submission,
        () =>
          acknowledgeSubmission({
            id: submission.id,
            // Version token: the row as rendered (F3 stale-view guard).
            expectedLastActivityAt: submission.lastActivityAt,
          }),
        'Unable to acknowledge submission',
        // Acknowledging only removes the row when the unacknowledged
        // filter is narrowing the list.
        searchParams.get('unacknowledged') === '1'
      ),
    [runRowAction, searchParams]
  )

  const handleArchiveConfirm = useCallback(() => {
    if (!archiveTarget) {
      return
    }

    const target = archiveTarget
    setArchiveTarget(null)
    runRowAction(
      target,
      () => archiveSubmission({ id: target.id }),
      'Unable to archive submission',
      true
    )
  }, [archiveTarget, runRowAction])

  const handleRestore = useCallback(
    (submission: FormSubmissionRecord) =>
      runRowAction(
        submission,
        () => restoreSubmission({ id: submission.id }),
        'Unable to restore submission',
        true
      ),
    [runRowAction]
  )

  const handleDestroyConfirm = useCallback(() => {
    if (!destroyTarget) {
      return
    }

    const target = destroyTarget
    setDestroyTarget(null)
    runRowAction(
      target,
      () => destroySubmission({ id: target.id }),
      'Unable to permanently delete submission',
      true
    )
  }, [destroyTarget, runRowAction])

  return (
    <div className='space-y-4'>
      {deepLinkNotFound && submissionParam ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked submission could not be found. It may have been
            permanently deleted.
          </span>
          <Button
            variant='ghost'
            size='sm'
            onClick={() =>
              updateParams({ submission: undefined }, { scroll: false })
            }
          >
            Dismiss
          </Button>
        </div>
      ) : null}
      <div className='overflow-hidden rounded-lg border'>
        <Table density='compact' layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className='w-6'>
                <span className='sr-only'>Unacknowledged</span>
              </TableHead>
              <SortableTableHead
                field='received'
                sort={sort}
                defaultSort='received:desc'
                onSortChange={next => updateListParams({ sort: next })}
                className='w-[11%]'
              >
                Received
              </SortableTableHead>
              <TableHead className='w-[9%]'>Form</TableHead>
              <TableHead className='w-[18%]'>Contact</TableHead>
              <TableHead className='w-[12%]'>Company</TableHead>
              <TableHead className='w-[10%]'>Status</TableHead>
              <TableHead className='w-[10%]'>Progress</TableHead>
              <TableHead>Phase</TableHead>
              {mode === 'archive' ? (
                <TableHead className='w-[10%]'>Archived</TableHead>
              ) : null}
              <TableHead className='w-32 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              submissions.map(submission => {
                const unacknowledged =
                  mode === 'active' && isUnacknowledgedSubmission(submission)

                return (
                  <TableRow
                    key={submission.id}
                    {...getClickableRowProps(() =>
                      handleSelect(submission.id)
                    )}
                    className={cn(
                      CLICKABLE_ROW_CLASS,
                      unacknowledged && 'font-medium',
                      submission.deletedAt && ARCHIVED_ROW_CLASS
                    )}
                  >
                    <TableCell className='w-6'>
                      {unacknowledged ? (
                        <>
                          <span
                            className='bg-primary block size-2 rounded-full'
                            aria-hidden='true'
                          />
                          <span className='sr-only'>Unacknowledged</span>
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {formatDistanceToNow(
                        new Date(submission.lastActivityAt),
                        { addSuffix: true }
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={cn(
                          FORM_SUBMISSION_KIND_TOKENS[submission.kind]
                        )}
                      >
                        {FORM_SUBMISSION_KIND_LABELS[submission.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {submission.contactName || submission.contactEmail ? (
                        // Single line so rows keep a uniform height: name
                        // first, email as muted secondary text. Both truncate;
                        // the detail sheet has the full values.
                        <div className='flex min-w-0 items-baseline gap-1.5'>
                          <span className='min-w-0 truncate'>
                            {submission.contactName ?? submission.contactEmail}
                          </span>
                          {submission.contactName && submission.contactEmail ? (
                            <span className='text-muted-foreground min-w-0 truncate text-xs'>
                              {submission.contactEmail}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className='text-muted-foreground italic'>
                          Anonymous
                        </span>
                      )}
                    </TableCell>
                    <TableCell className='truncate'>
                      {submission.contactCompany ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={cn(
                          FORM_SUBMISSION_STATUS_TOKENS[submission.status]
                        )}
                      >
                        {FORM_SUBMISSION_STATUS_LABELS[submission.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {submission.percentComplete === null ? (
                        <span className='text-muted-foreground'>—</span>
                      ) : (
                        <div className='flex items-center gap-2'>
                          <Progress
                            value={submission.percentComplete}
                            className='w-16'
                          />
                          <span className='text-muted-foreground text-xs'>
                            {submission.percentComplete}%
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='truncate'>
                      {submission.result?.phaseName ??
                        submission.phaseId ?? (
                          <span className='text-muted-foreground'>—</span>
                        )}
                    </TableCell>
                    {mode === 'archive' ? (
                      <TableCell className='text-muted-foreground text-sm whitespace-nowrap'>
                        {submission.deletedAt
                          ? formatDistanceToNow(
                              new Date(submission.deletedAt),
                              { addSuffix: true }
                            )
                          : '—'}
                      </TableCell>
                    ) : null}
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        {unacknowledged ? (
                          <Button
                            variant='outline'
                            size='icon-sm'
                            title='Acknowledge submission'
                            aria-label='Acknowledge submission'
                            disabled={pendingId === submission.id}
                            onClick={event => {
                              event.stopPropagation()
                              handleAcknowledge(submission)
                            }}
                          >
                            <Check className='h-4 w-4' />
                            <span className='sr-only'>Acknowledge</span>
                          </Button>
                        ) : null}
                        {mode === 'active' ? (
                          <Button
                            variant='destructive'
                            size='icon-sm'
                            title='Archive submission'
                            aria-label='Archive submission'
                            disabled={pendingId === submission.id}
                            onClick={event => {
                              event.stopPropagation()
                              setArchiveTarget(submission)
                            }}
                          >
                            <Archive className='h-4 w-4' />
                            <span className='sr-only'>Archive</span>
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant='outline'
                              size='icon-sm'
                              title='Restore submission'
                              aria-label='Restore submission'
                              disabled={pendingId === submission.id}
                              onClick={event => {
                                event.stopPropagation()
                                handleRestore(submission)
                              }}
                            >
                              <RefreshCw className='h-4 w-4' />
                              <span className='sr-only'>Restore</span>
                            </Button>
                            <Button
                              variant='destructive'
                              size='icon-sm'
                              title='Permanently delete submission'
                              aria-label='Permanently delete submission'
                              disabled={pendingId === submission.id}
                              onClick={event => {
                                event.stopPropagation()
                                setDestroyTarget(submission)
                              }}
                            >
                              <Trash2 className='h-4 w-4' />
                              <span className='sr-only'>
                                Delete permanently
                              </span>
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <PaginationControls
          mode='paged'
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={page =>
            updateParams({ page: page === 1 ? undefined : String(page) })
          }
        />
      )}

      <SubmissionArchiveDialog
        open={archiveTarget !== null}
        confirmDisabled={pendingId !== null}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
      />

      <ConfirmDialog
        open={destroyTarget !== null}
        title='Permanently delete submission?'
        description={
          destroyTarget
            ? `Permanently deleting the submission from ${describeSubmission(destroyTarget)} removes it and its history. This action cannot be undone.`
            : 'Permanently deleting this submission removes it and its history. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={pendingId !== null}
        onCancel={() => setDestroyTarget(null)}
        onConfirm={handleDestroyConfirm}
      />

      <SubmissionDetailSheet
        submission={selected}
        mode={mode}
        onRowRemoved={() => refreshAfterAction(true)}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  )
}
