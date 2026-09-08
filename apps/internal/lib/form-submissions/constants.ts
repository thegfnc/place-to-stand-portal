import { formSubmissionKind, formSubmissionStatus } from '@/lib/db/schema'

export const FORM_SUBMISSION_KIND_VALUES = formSubmissionKind.enumValues
export const FORM_SUBMISSION_STATUS_VALUES = formSubmissionStatus.enumValues

export type FormSubmissionKind = (typeof FORM_SUBMISSION_KIND_VALUES)[number]
export type FormSubmissionStatus =
  (typeof FORM_SUBMISSION_STATUS_VALUES)[number]

export const FORM_SUBMISSION_KIND_LABELS: Record<FormSubmissionKind, string> = {
  audit: 'Audit',
  contact: 'Contact',
}

export const FORM_SUBMISSION_STATUS_LABELS: Record<
  FormSubmissionStatus,
  string
> = {
  in_progress: 'In Progress',
  abandoned: 'Abandoned',
  completed: 'Completed',
  captured: 'Captured',
}

export const FORM_SUBMISSION_STATUS_TOKENS: Record<
  FormSubmissionStatus,
  string
> = {
  in_progress:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  abandoned:
    'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
  completed:
    'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  captured:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
}

export const FORM_SUBMISSION_KIND_TOKENS: Record<FormSubmissionKind, string> = {
  audit:
    'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  contact:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
}

/**
 * D1 (PRD 001): only rows that warrant attention count as unacknowledged —
 * contact submissions (any status) and audits that reached
 * `completed`/`captured`. In-progress and abandoned audits are noise at ad
 * volume and never flag.
 *
 * Terminology (2026-08-04 revision): the UI converges on the
 * "acknowledge" family everywhere — indicator/badge/filter say
 * "Unacknowledged", the actions are Acknowledge/Unacknowledge.
 *
 * Must stay in sync with the SQL predicates in
 * `apps/internal/lib/queries/form-submissions.ts` (`buildFilters`
 * unacknowledgedOnly + `countUnacknowledgedFormSubmissions`).
 */
const ATTENTION_AUDIT_STATUSES = [
  'completed',
  'captured',
] as const satisfies readonly FormSubmissionStatus[]

/**
 * Whether acknowledgement is meaningful for this row at all. In-progress and
 * abandoned audits never flag, so they get no acknowledge/unacknowledge
 * affordances anywhere in the UI.
 */
export function submissionWarrantsAttention(submission: {
  kind: FormSubmissionKind
  status: FormSubmissionStatus
}): boolean {
  return (
    submission.kind === 'contact' ||
    (ATTENTION_AUDIT_STATUSES as readonly string[]).includes(submission.status)
  )
}

export function isUnacknowledgedSubmission(submission: {
  kind: FormSubmissionKind
  status: FormSubmissionStatus
  acknowledgedAt: string | null
  deletedAt: string | null
}): boolean {
  if (submission.acknowledgedAt !== null || submission.deletedAt !== null) {
    return false
  }
  return submissionWarrantsAttention(submission)
}

export function isFormSubmissionKind(
  value: string | undefined
): value is FormSubmissionKind {
  return (
    value !== undefined &&
    (FORM_SUBMISSION_KIND_VALUES as readonly string[]).includes(value)
  )
}

export function isFormSubmissionStatus(
  value: string | undefined
): value is FormSubmissionStatus {
  return (
    value !== undefined &&
    (FORM_SUBMISSION_STATUS_VALUES as readonly string[]).includes(value)
  )
}
