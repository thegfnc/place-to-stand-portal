import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

type SubmissionEventArgs = {
  kind: 'audit' | 'contact'
  contactName?: string | null
  contactEmail?: string | null
  status: string
}

/** "Jane Doe (jane@x.com)" | name | email | "anonymous audit submission" */
const describeSubmission = (args: SubmissionEventArgs): string => {
  const name = args.contactName?.trim()
  const email = args.contactEmail?.trim()

  if (name && email) {
    return `submission from ${name} (${email})`
  }

  if (name || email) {
    return `submission from ${name || email}`
  }

  return `anonymous ${args.kind} submission`
}

export const submissionAcknowledgedEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_ACKNOWLEDGED,
  summary: `Acknowledged ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionUnacknowledgedEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_UNACKNOWLEDGED,
  summary: `Marked ${describeSubmission(args)} as unacknowledged`,
  metadata: toMetadata({ status: args.status }),
})

/**
 * Deliberately PII-free, unlike the other builders: "Delete forever"
 * promises the prospect's data is gone, so the surviving audit event must
 * not re-embed their name/email in its summary.
 */
export const submissionDestroyedEvent = (args: {
  kind: 'audit' | 'contact'
  status: string
}): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_DESTROYED,
  summary: `Permanently deleted ${
    args.kind === 'contact' ? 'a contact submission' : 'an audit submission'
  }`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionArchivedEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_ARCHIVED,
  summary: `Archived ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionRestoredEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_RESTORED,
  summary: `Restored ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

/**
 * Machine-emitted on first insert only (never on a later audit beacon).
 * PII-free like `submissionDestroyedEvent`: the row itself carries the
 * contact details, and the audit trail must not outlive a "Delete forever".
 */
export const submissionReceivedEvent = (args: {
  formType: 'audit' | 'contact'
  status: string
}): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_RECEIVED,
  summary: `Received a new ${args.formType} submission`,
  metadata: toMetadata({ formType: args.formType, status: args.status }),
})

/** One row per cron sweep that actually flipped something. */
export const submissionsAbandonedEvent = (args: {
  count: number
  staleAfterHours: number
}): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSIONS_ABANDONED,
  summary: `Marked ${args.count} stale in-progress audit submission${
    args.count === 1 ? '' : 's'
  } as abandoned`,
  metadata: toMetadata({
    count: args.count,
    staleAfterHours: args.staleAfterHours,
  }),
})
