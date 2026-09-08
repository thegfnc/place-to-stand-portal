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

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className='space-y-3'>
      <h3 className='text-sm font-semibold tracking-tight'>{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[9rem_1fr] gap-2 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      {/* min-w-0 lets the 1fr track shrink below its content's min-content
          width so long unbroken tokens (GCLIDs, URLs) wrap instead of
          forcing horizontal overflow. */}
      <dd className='min-w-0 break-words'>{value ?? '—'}</dd>
    </div>
  )
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
          <div className='space-y-6 px-4 pt-6 pb-8'>
            <Section title='Status'>
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
              <dl className='space-y-2'>
                <Field
                  label='Started'
                  value={format(
                    new Date(displaySubmission.startedAt),
                    "d MMM yyyy 'at' HH:mm"
                  )}
                />
                <Field
                  label='Time on page'
                  value={
                    displaySubmission.durationMs !== null
                      ? `${Math.round(displaySubmission.durationMs / 1000)}s`
                      : '—'
                  }
                />
                {mode === 'active' && warrantsAttention && acknowledged ? (
                  <Field
                    label='Acknowledged'
                    value={
                      override
                        ? 'Just now'
                        : acknowledgedAt
                          ? formatDistanceToNow(new Date(acknowledgedAt), {
                              addSuffix: true,
                            })
                          : 'Yes'
                    }
                  />
                ) : null}
              </dl>
            </Section>

            <Separator />
            <Section title='Contact'>
              <dl className='space-y-2'>
                <Field
                  label='Name'
                  value={value(displaySubmission.contactName)}
                />
                <Field
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
                <Field
                  label='Company'
                  value={value(displaySubmission.contactCompany)}
                />
                <Field
                  label='Website'
                  value={value(displaySubmission.contactWebsite)}
                />
                {!isAudit && (
                  <Field
                    label='Subject'
                    value={value(displaySubmission.subject)}
                  />
                )}
                <Field
                  label='Marketing consent'
                  value={value(displaySubmission.marketingConsent)}
                />
              </dl>
              {displaySubmission.message && (
                <p className='bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap'>
                  {displaySubmission.message}
                </p>
              )}
            </Section>

            {isAudit && (
              <>
                <Separator />
                <Section
                  title={`Answers (${displaySubmission.answeredCount ?? 0} of ${displaySubmission.questionsTotal ?? 0})`}
                >
                  {displaySubmission.responses.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      No answers recorded.
                    </p>
                  ) : (
                    <ol className='space-y-3'>
                      {displaySubmission.responses.map((response, index) => (
                        <li
                          key={`${response.questionId}-${index}`}
                          className='space-y-1'
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
                </Section>
              </>
            )}

            {displaySubmission.result && (
              <>
                <Separator />
                <Section title='Result'>
                  <dl className='space-y-2'>
                    <Field
                      label='Phase'
                      value={value(displaySubmission.result.phaseName)}
                    />
                    <Field
                      label='Generated by'
                      value={value(displaySubmission.result.generatedBy)}
                    />
                  </dl>
                  <p className='text-sm'>{displaySubmission.result.summary}</p>
                  {displaySubmission.result.recommendations.length > 0 && (
                    <ul className='space-y-3'>
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
                </Section>
              </>
            )}

            {hasAttribution && (
              <>
                <Separator />
                <Section title='Attribution'>
                  <dl className='space-y-2'>
                    <Field
                      label='Source'
                      value={value(displaySubmission.utmSource)}
                    />
                    <Field
                      label='Medium'
                      value={value(displaySubmission.utmMedium)}
                    />
                    <Field
                      label='Campaign'
                      value={value(displaySubmission.utmCampaign)}
                    />
                    <Field
                      label='Term'
                      value={value(displaySubmission.utmTerm)}
                    />
                    <Field
                      label='Content'
                      value={value(displaySubmission.utmContent)}
                    />
                    <Field
                      label='GCLID'
                      value={value(displaySubmission.gclid)}
                    />
                    <Field
                      label='Referrer'
                      value={value(displaySubmission.referrer)}
                    />
                    <Field
                      label='Landing path'
                      value={value(displaySubmission.landingPath)}
                    />
                  </dl>
                </Section>
              </>
            )}

            <Separator />
            <Section title='Session'>
              <dl className='space-y-2'>
                <Field
                  label='Source'
                  value={value(displaySubmission.sourceDetail)}
                />
                <Field
                  label='Viewport'
                  value={value(displaySubmission.viewport)}
                />
                <Field
                  label='Screen width'
                  value={
                    displaySubmission.screenWidth
                      ? `${displaySubmission.screenWidth}px`
                      : '—'
                  }
                />
                <Field
                  label='Timezone'
                  value={value(displaySubmission.timezone)}
                />
                <Field
                  label='Language'
                  value={value(displaySubmission.language)}
                />
                <Field
                  label='User agent'
                  value={value(displaySubmission.userAgent)}
                />
                <Field
                  label='Session key'
                  value={
                    <code className='text-xs'>
                      {displaySubmission.sessionKey}
                    </code>
                  }
                />
              </dl>
              {displaySubmission.posthogReplayUrl && (
                <a
                  href={displaySubmission.posthogReplayUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
                >
                  Watch session replay
                  <ExternalLink className='size-3' />
                </a>
              )}
            </Section>
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
