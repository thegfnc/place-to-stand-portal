'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Separator } from '@pts/ui/separator'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFooterBar } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetSection } from '@/components/sheets/sheet-section'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_TOKENS,
  submissionWarrantsAttention,
} from '@/lib/form-submissions/constants'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'
import {
  acknowledgeSubmission,
  archiveSubmission,
  destroySubmission,
  restoreSubmission,
  unacknowledgeSubmission,
} from '../actions'

import { SubmissionArchiveDialog } from './submission-archive-dialog'

type SubmissionDetailSheetProps = {
  submission: FormSubmissionRecord | null
  mode: 'active' | 'archive'
  onOpenChange: (open: boolean) => void
  /** Called instead of a plain refresh when an action removed the row from the current list (pagination back-step). */
  onRowRemoved?: () => void
}

type KvProps = {
  label: string
  value: React.ReactNode
  /** Span both columns — for long unbroken values (user agent, keys). */
  wide?: boolean
}

/** One label-over-value cell of a two-column definition grid. */
function Kv({ label, value, wide = false }: KvProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', wide && 'sm:col-span-2')}>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      {/* min-w-0 + break-words let long unbroken tokens (GCLIDs, URLs)
          wrap instead of forcing horizontal overflow. */}
      <dd className='min-w-0 text-sm break-words'>{value ?? '—'}</dd>
    </div>
  )
}

const KV_GRID = 'grid gap-x-4 gap-y-3 sm:grid-cols-2'

/** "42s" under a minute, "3m 12s" above it. */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  if (total < 60) {
    return `${total}s`
  }
  return `${Math.floor(total / 60)}m ${total % 60}s`
}

/** Renders `—` for null/empty so empty fields read consistently. */
function value(input: string | number | boolean | null | undefined) {
  if (input === null || input === undefined || input === '') {
    return '—'
  }
  if (typeof input === 'boolean') {
    return input ? 'Yes' : 'No'
  }
  return String(input)
}

function formatAnswer(
  raw: FormSubmissionRecord['responses'][number]
): React.ReactNode {
  if (raw.labels.length > 0) {
    return raw.labels.join(', ')
  }
  if (typeof raw.value === 'string' && raw.value.trim()) {
    return raw.value
  }
  if (Array.isArray(raw.value) && raw.value.length > 0) {
    return raw.value.join(', ')
  }
  return <span className='text-muted-foreground italic'>Unanswered</span>
}

export function SubmissionDetailSheet({
  submission,
  mode,
  onOpenChange,
  onRowRemoved,
}: SubmissionDetailSheetProps) {
  const router = useRouter()
  const { toast } = useToast()
  // D9: acknowledge/unacknowledge keep the sheet open, so the state is
  // lifted optimistically — the `submission` prop is stale only until the
  // parent re-renders from router.refresh() (selection is derived from
  // fresh props in the table).
  const [ackOverride, setAckOverride] = useState<{
    id: string
    acknowledged: boolean
  } | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [destroyConfirmOpen, setDestroyConfirmOpen] = useState(false)
  const [retainedSubmission, setRetainedSubmission] = useState(submission)
  const [isPending, startTransition] = useTransition()

  // Reconcile the optimistic override: drop it when the sheet closes, a
  // different row is opened, or the refreshed server state confirms it.
  // Without this, re-opening a row after an external change (e.g. a D8
  // beacon reset) would replay a stale "acknowledged" override. Uses the
  // adjust-state-during-render pattern (not an effect) so React restarts
  // the render immediately instead of cascading a second commit.
  if (
    ackOverride &&
    (!submission ||
      submission.id !== ackOverride.id ||
      (submission.acknowledgedAt !== null) === ackOverride.acknowledged)
  ) {
    setAckOverride(null)
  }

  // Keep-open actions: run, then refresh underneath the open sheet.
  const runInlineAction = useCallback(
    (
      run: () => Promise<{ error?: string }>,
      errorTitle: string,
      onSuccess: () => void
    ) => {
      if (!submission) {
        return
      }

      startTransition(async () => {
        const result = await run()

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

        onSuccess()
        router.refresh()
      })
    },
    [router, submission, toast]
  )

  const handleAcknowledge = useCallback(() => {
    if (!submission) {
      return
    }
    runInlineAction(
      () =>
        acknowledgeSubmission({
          id: submission.id,
          // Version token: the row as rendered (F3 stale-view guard).
          expectedLastActivityAt: submission.lastActivityAt,
        }),
      'Unable to acknowledge submission',
      () => setAckOverride({ id: submission.id, acknowledged: true })
    )
  }, [runInlineAction, submission])

  const handleUnacknowledge = useCallback(() => {
    if (!submission) {
      return
    }
    runInlineAction(
      () => unacknowledgeSubmission({ id: submission.id }),
      'Unable to unacknowledge submission',
      () => setAckOverride({ id: submission.id, acknowledged: false })
    )
  }, [runInlineAction, submission])

  // D9: archive/restore/destroy CLOSE the sheet — the row leaves the
  // current tab's list.
  const runClosingAction = useCallback(
    (
      action: (input: { id: string }) => Promise<{ error?: string }>,
      errorTitle: string
    ) => {
      if (!submission) {
        return
      }

      startTransition(async () => {
        const result = await action({ id: submission.id })

        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        onOpenChange(false)

        // The row left this tab's list — let the parent step pagination
        // back if that emptied the page.
        if (onRowRemoved) {
          onRowRemoved()
        } else {
          router.refresh()
        }
      })
    },
    [onOpenChange, onRowRemoved, router, submission, toast]
  )

  const handleArchiveConfirm = useCallback(() => {
    setArchiveConfirmOpen(false)
    runClosingAction(archiveSubmission, 'Unable to archive submission')
  }, [runClosingAction])

  const handleRestore = useCallback(() => {
    runClosingAction(restoreSubmission, 'Unable to restore submission')
  }, [runClosingAction])

  const handleDestroyConfirm = useCallback(() => {
    setDestroyConfirmOpen(false)
    runClosingAction(
      destroySubmission,
      'Unable to permanently delete submission'
    )
  }, [runClosingAction])

  // Retain the last row through the close animation — the parent nulls
  // `submission` on close, and unmounting instantly would skip the sheet's
  // exit transition (adjust-during-render retention).
  if (submission && submission !== retainedSubmission) {
    setRetainedSubmission(submission)
  }
  const displaySubmission = submission ?? retainedSubmission

  if (!displaySubmission) {
    return null
  }

  const override = ackOverride?.id === displaySubmission.id ? ackOverride : null
  const acknowledged = override
    ? override.acknowledged
    : displaySubmission.acknowledgedAt !== null
  // Acknowledgement only exists as a concept for rows that can flag —
  // in-progress/abandoned audits get no acknowledge-family UI at all.
  const warrantsAttention = submissionWarrantsAttention(displaySubmission)
  const unacknowledged = mode === 'active' && warrantsAttention && !acknowledged
  const acknowledgedAt = displaySubmission.acknowledgedAt

  const isAudit = displaySubmission.kind === 'audit'
  const hasAttribution = Boolean(
    displaySubmission.utmSource ||
    displaySubmission.utmMedium ||
    displaySubmission.utmCampaign ||
    displaySubmission.utmTerm ||
    displaySubmission.utmContent ||
    displaySubmission.gclid ||
    displaySubmission.referrer ||
    displaySubmission.landingPath
  )

  return (
    <Sheet open={Boolean(submission)} onOpenChange={onOpenChange}>
      <SheetContent
        hideCloseButton
        size='xl'
        className='flex w-full flex-col gap-0 overflow-hidden p-0'
      >
        <SheetFormHeader
          entity='submission'
          title={`${FORM_SUBMISSION_KIND_LABELS[displaySubmission.kind]} submission`}
        />

        <div className='flex-1 overflow-y-auto'>
          <div className='flex flex-col gap-6 px-6 pt-6 pb-8'>
            <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge
                  variant='outline'
                  className={cn(
                    FORM_SUBMISSION_STATUS_TOKENS[displaySubmission.status]
                  )}
                >
                  {FORM_SUBMISSION_STATUS_LABELS[displaySubmission.status]}
                </Badge>
                {unacknowledged ? (
                  <Badge variant='secondary'>Unacknowledged</Badge>
                ) : null}
              </div>
              <p className='text-muted-foreground text-xs'>
                {[
                  `Started ${format(
                    new Date(displaySubmission.startedAt),
                    "d MMM yyyy 'at' HH:mm"
                  )}`,
                  displaySubmission.durationMs !== null
                    ? `${formatDuration(displaySubmission.durationMs)} on page`
                    : null,
                  mode === 'active' && warrantsAttention && acknowledged
                    ? `Acknowledged ${
                        override
                          ? 'just now'
                          : acknowledgedAt
                            ? formatDistanceToNow(new Date(acknowledgedAt), {
                                addSuffix: true,
                              })
                            : ''
                      }`.trim()
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            <Separator />
            <SheetSection title='Contact'>
              <dl className={KV_GRID}>
                <Kv label='Name' value={value(displaySubmission.contactName)} />
                <Kv
                  label='Email'
                  value={
                    displaySubmission.contactEmail ? (
                      // PW2: the natural post-triage action is emailing the
                      // prospect — make the address actionable.
                      <a
                        href={`mailto:${displaySubmission.contactEmail}`}
                        className='text-primary hover:underline'
                      >
                        {displaySubmission.contactEmail}
                      </a>
                    ) : (
                      '—'
                    )
                  }
                />
                <Kv
                  label='Company'
                  value={value(displaySubmission.contactCompany)}
                />
                <Kv
                  label='Website'
                  value={value(displaySubmission.contactWebsite)}
                />
                {!isAudit && (
                  <Kv
                    label='Subject'
                    value={value(displaySubmission.subject)}
                  />
                )}
                <Kv
                  label='Marketing consent'
                  value={value(displaySubmission.marketingConsent)}
                />
                <Kv
                  label='Source'
                  value={value(displaySubmission.sourceDetail)}
                />
              </dl>
              {displaySubmission.message && (
                <div className='flex flex-col gap-1'>
                  <span className='text-muted-foreground text-xs'>Message</span>
                  <p className='bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap'>
                    {displaySubmission.message}
                  </p>
                </div>
              )}
            </SheetSection>

            {isAudit && (
              <>
                <Separator />
                <SheetSection
                  title='Answers'
                  action={
                    <span className='text-muted-foreground text-xs'>
                      {displaySubmission.answeredCount ?? 0} of{' '}
                      {displaySubmission.questionsTotal ?? 0} answered
                    </span>
                  }
                >
                  {displaySubmission.responses.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      No answers recorded.
                    </p>
                  ) : (
                    <ol className='flex flex-col gap-3'>
                      {displaySubmission.responses.map((response, index) => (
                        <li
                          key={`${response.questionId}-${index}`}
                          className='flex flex-col gap-1'
                        >
                          <p className='text-muted-foreground text-xs'>
                            {response.sectionId}
                          </p>
                          <p className='text-sm font-medium'>
                            {response.prompt}
                          </p>
                          <p className='text-sm'>{formatAnswer(response)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </SheetSection>
              </>
            )}

            {displaySubmission.result && (
              <>
                <Separator />
                <SheetSection title='Result'>
                  <dl className={KV_GRID}>
                    <Kv
                      label='Phase'
                      value={value(displaySubmission.result.phaseName)}
                    />
                    <Kv
                      label='Generated by'
                      value={value(displaySubmission.result.generatedBy)}
                    />
                  </dl>
                  <p className='text-sm'>{displaySubmission.result.summary}</p>
                  {displaySubmission.result.recommendations.length > 0 && (
                    <ul className='flex flex-col gap-2'>
                      {displaySubmission.result.recommendations.map(rec => (
                        <li
                          key={rec.serviceId}
                          className='rounded-md border p-3 text-sm'
                        >
                          <div className='flex items-center justify-between gap-2'>
                            <span className='font-medium'>
                              {rec.serviceName}
                            </span>
                            <span className='text-muted-foreground text-xs'>
                              score {rec.score}
                            </span>
                          </div>
                          {rec.reasons.length > 0 && (
                            <ul className='text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-xs'>
                              {rec.reasons.map((reason, index) => (
                                <li key={index}>{reason}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </SheetSection>
              </>
            )}

            {hasAttribution && (
              <>
                <Separator />
                <SheetSection title='Attribution'>
                  <dl className={KV_GRID}>
                    <Kv
                      label='Source'
                      value={value(displaySubmission.utmSource)}
                    />
                    <Kv
                      label='Medium'
                      value={value(displaySubmission.utmMedium)}
                    />
                    <Kv
                      label='Campaign'
                      value={value(displaySubmission.utmCampaign)}
                    />
                    <Kv label='Term' value={value(displaySubmission.utmTerm)} />
                    <Kv
                      label='Content'
                      value={value(displaySubmission.utmContent)}
                    />
                    <Kv label='GCLID' value={value(displaySubmission.gclid)} />
                    <Kv
                      label='Referrer'
                      value={value(displaySubmission.referrer)}
                    />
                    <Kv
                      label='Landing path'
                      value={value(displaySubmission.landingPath)}
                    />
                  </dl>
                </SheetSection>
              </>
            )}

            <Separator />
            <SheetSection title='Session'>
              <dl className={KV_GRID}>
                <Kv
                  label='Viewport'
                  value={value(displaySubmission.viewport)}
                />
                <Kv
                  label='Screen width'
                  value={
                    displaySubmission.screenWidth
                      ? `${displaySubmission.screenWidth}px`
                      : '—'
                  }
                />
                <Kv
                  label='Timezone'
                  value={value(displaySubmission.timezone)}
                />
                <Kv
                  label='Language'
                  value={value(displaySubmission.language)}
                />
                <Kv
                  label='User agent'
                  value={value(displaySubmission.userAgent)}
                  wide
                />
                <Kv
                  label='Session key'
                  value={
                    <code className='text-xs'>
                      {displaySubmission.sessionKey}
                    </code>
                  }
                  wide
                />
              </dl>
              {displaySubmission.posthogReplayUrl && (
                <a
                  href={displaySubmission.posthogReplayUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary inline-flex w-fit items-center gap-1 text-sm hover:underline'
                >
                  Watch session replay
                  <ExternalLink className='size-3' />
                </a>
              )}
            </SheetSection>
          </div>
        </div>

        <SheetFooterBar>
          <div className='flex items-center gap-1.5'>
            {mode === 'active' ? (
              warrantsAttention ? (
                unacknowledged ? (
                  <Button
                    type='button'
                    size='sm'
                    disabled={isPending}
                    onClick={handleAcknowledge}
                  >
                    <Check className='mr-1 h-4 w-4' />
                    {isPending ? 'Acknowledging…' : 'Acknowledge'}
                  </Button>
                ) : (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={isPending}
                    onClick={handleUnacknowledge}
                  >
                    <Undo2 className='mr-1 h-4 w-4' />
                    Unacknowledge
                  </Button>
                )
              ) : null
            ) : (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={isPending}
                onClick={handleRestore}
              >
                <RefreshCw className='h-4 w-4' />
                Restore
              </Button>
            )}
          </div>
          {mode === 'active' ? (
            <Button
              type='button'
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              title='Archive submission'
              aria-label='Archive submission'
              disabled={isPending}
              onClick={() => setArchiveConfirmOpen(true)}
            >
              <Archive className='h-4 w-4' />
              <span className='sr-only'>Archive</span>
            </Button>
          ) : (
            <Button
              type='button'
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              title='Permanently delete submission'
              aria-label='Permanently delete submission'
              disabled={isPending}
              onClick={() => setDestroyConfirmOpen(true)}
            >
              <Trash2 className='h-4 w-4' />
              <span className='sr-only'>Delete permanently</span>
            </Button>
          )}
        </SheetFooterBar>

        <SubmissionArchiveDialog
          open={archiveConfirmOpen}
          confirmDisabled={isPending}
          onCancel={() => setArchiveConfirmOpen(false)}
          onConfirm={handleArchiveConfirm}
        />

        <ConfirmDialog
          open={destroyConfirmOpen}
          title='Permanently delete submission?'
          description={`Permanently deleting the submission from ${
            displaySubmission.contactName ||
            displaySubmission.contactEmail ||
            'this anonymous visitor'
          } removes it and its history. This action cannot be undone.`}
          confirmLabel='Delete forever'
          confirmVariant='destructive'
          confirmDisabled={isPending}
          onCancel={() => setDestroyConfirmOpen(false)}
          onConfirm={handleDestroyConfirm}
        />
      </SheetContent>
    </Sheet>
  )
}
