import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs, formSubmissions } from '@/lib/db/schema'
import {
  DEFAULT_SUBMISSIONS_SORT,
  type SubmissionSortField,
} from '@/lib/form-submissions/filters'
import { createSearchPattern } from '@/lib/pagination/cursor'
import type { ParsedSort } from '@/lib/pagination/sort'
import type { FormSubmission, NewFormSubmission } from '@pts/db/types'

type FormSubmissionFilters = {
  kind?: FormSubmission['kind']
  status?: FormSubmission['status']
  /**
   * D1 unacknowledged predicate (PW1 filter) — MUST stay in sync with
   * `isUnacknowledgedSubmission` in
   * apps/internal/lib/form-submissions/constants.ts.
   */
  unacknowledgedOnly?: boolean
  /** Complement of the quick filter: rows an admin has already cleared. */
  acknowledgedOnly?: boolean
  /** false/undefined: active rows (deleted_at IS NULL). true: archived rows. */
  archived?: boolean
  /** Fuzzy identity search (PRD 004 §03) — name, email, company. */
  search?: string
}

function buildFilters({
  kind,
  status,
  unacknowledgedOnly,
  acknowledgedOnly,
  archived,
  search,
}: FormSubmissionFilters) {
  const searchQuery = search?.trim() ?? ''
  const searchPattern = searchQuery ? createSearchPattern(searchQuery) : null

  return and(
    archived
      ? isNotNull(formSubmissions.deletedAt)
      : isNull(formSubmissions.deletedAt),
    // Tombstones never appear anywhere, including the archive.
    isNull(formSubmissions.destroyedAt),
    kind ? eq(formSubmissions.kind, kind) : undefined,
    status ? eq(formSubmissions.status, status) : undefined,
    unacknowledgedOnly
      ? and(
          isNull(formSubmissions.acknowledgedAt),
          or(
            eq(formSubmissions.kind, 'contact'),
            inArray(formSubmissions.status, ['completed', 'captured'])
          )
        )
      : undefined,
    acknowledgedOnly ? isNotNull(formSubmissions.acknowledgedAt) : undefined,
    searchPattern
      ? or(
          ilike(formSubmissions.contactName, searchPattern),
          ilike(formSubmissions.contactEmail, searchPattern),
          ilike(formSubmissions.contactCompany, searchPattern),
          ilike(formSubmissions.subject, searchPattern)
        )
      : undefined
  )
}

/**
 * Idempotent write for both marketing intake routes.
 *
 * Audit beacons race — `sendBeacon` on `pagehide` has no delivery-ordering
 * guarantee, so a stale `abandoned` beacon routinely lands after `captured`.
 * All four ordering rules from the integration contract are enforced here in a
 * single statement; a read-then-write would race exactly the way the beacons
 * do.
 *
 *   1. Upsert on `session_key`.
 *   2. Stale beacons are discarded  -> the `setWhere` gate below.
 *   3. Status only advances         -> GREATEST over the status enum, whose
 *                                      DECLARATION ORDER in packages/db is the
 *                                      rank order. Postgres compares enums by
 *                                      that order, so no CASE ladder is needed.
 *   4. Non-null values are never
 *      overwritten with null        -> COALESCE(excluded.x, existing.x).
 *
 * Field-by-field policy:
 *   - GREATEST for monotonic values (status, furthest step, counters, duration)
 *     — they only ever move one way, and this is immune to a beacon that
 *     reports zeros.
 *   - COALESCE for everything nullable and irreplaceable: the scored result,
 *     the contact block, and the analytics/attribution/client envelope. Losing
 *     UTM attribution because one late beacon omitted it would be silent and
 *     unrecoverable.
 *   - Wholesale from `excluded` for values that describe the newest beacon
 *     itself (`last_trigger`, `last_activity_at`) or the current snapshot
 *     (`steps_total`, `questions_total`).
 *   - `responses` takes the newer array UNLESS that would replace a populated
 *     transcript with an empty one. The contract says every beacon carries the
 *     full question set; this guards the one violation that would destroy the
 *     most valuable data on the row.
 *
 * Note: because `answered_count` uses GREATEST while `responses` takes the
 * newer array, a visitor who clears an answer leaves the count one higher than
 * the array. That is a cosmetic edge case, and preferable to a zeroing beacon
 * wiping real progress.
 *
 * Acknowledgement (D8, PRD 001): `acknowledged_at`/`acknowledged_by` reset to
 * NULL when and only when status advances. A reviewed row that gains new
 * signal (completed -> captured is the one that matters) must re-flag as
 * unread; a beacon that doesn't advance status leaves the acknowledgement
 * alone.
 *
 * Contact submissions run through the same path. They are one-shot with a
 * unique `submissionId`, so they never conflict and every rule above is a
 * no-op for them.
 */
export async function upsertFormSubmission(row: NewFormSubmission) {
  await db
    .insert(formSubmissions)
    .values(row)
    .onConflictDoUpdate({
      target: formSubmissions.sessionKey,
      set: {
        status: sql`GREATEST(${formSubmissions.status}, excluded.status)`,
        lastTrigger: sql`excluded.last_trigger`,
        lastActivityAt: sql`excluded.last_activity_at`,
        completedAt: sql`COALESCE(${formSubmissions.completedAt}, excluded.completed_at)`,
        capturedAt: sql`COALESCE(${formSubmissions.capturedAt}, excluded.captured_at)`,
        durationMs: sql`GREATEST(${formSubmissions.durationMs}, excluded.duration_ms)`,

        furthestStepIndex: sql`GREATEST(${formSubmissions.furthestStepIndex}, excluded.furthest_step_index)`,
        stepsTotal: sql`excluded.steps_total`,
        answeredCount: sql`GREATEST(${formSubmissions.answeredCount}, excluded.answered_count)`,
        questionsTotal: sql`excluded.questions_total`,
        percentComplete: sql`GREATEST(${formSubmissions.percentComplete}, excluded.percent_complete)`,

        responses: sql`
          CASE
            WHEN jsonb_array_length(COALESCE(excluded.responses, '[]'::jsonb)) > 0
              THEN excluded.responses
            ELSE ${formSubmissions.responses}
          END
        `,
        result: sql`COALESCE(excluded.result, ${formSubmissions.result})`,
        phaseId: sql`COALESCE(excluded.phase_id, ${formSubmissions.phaseId})`,
        topServiceId: sql`COALESCE(excluded.top_service_id, ${formSubmissions.topServiceId})`,

        contactName: sql`COALESCE(excluded.contact_name, ${formSubmissions.contactName})`,
        contactEmail: sql`COALESCE(excluded.contact_email, ${formSubmissions.contactEmail})`,
        contactCompany: sql`COALESCE(excluded.contact_company, ${formSubmissions.contactCompany})`,
        contactWebsite: sql`COALESCE(excluded.contact_website, ${formSubmissions.contactWebsite})`,
        subject: sql`COALESCE(excluded.subject, ${formSubmissions.subject})`,
        message: sql`COALESCE(excluded.message, ${formSubmissions.message})`,
        marketingConsent: sql`COALESCE(excluded.marketing_consent, ${formSubmissions.marketingConsent})`,

        // Acknowledgement resets when status advances: a reviewed row that
        // gains new signal must re-flag as unread. Status can only advance
        // (GREATEST above), so a strict > comparison is exactly "advanced".
        acknowledgedAt: sql`
          CASE
            WHEN excluded.status > ${formSubmissions.status}
              THEN NULL
            ELSE ${formSubmissions.acknowledgedAt}
          END
        `,
        acknowledgedBy: sql`
          CASE
            WHEN excluded.status > ${formSubmissions.status}
              THEN NULL
            ELSE ${formSubmissions.acknowledgedBy}
          END
        `,

        posthogDistinctId: sql`COALESCE(excluded.posthog_distinct_id, ${formSubmissions.posthogDistinctId})`,
        posthogSessionId: sql`COALESCE(excluded.posthog_session_id, ${formSubmissions.posthogSessionId})`,
        posthogReplayUrl: sql`COALESCE(excluded.posthog_replay_url, ${formSubmissions.posthogReplayUrl})`,

        utmSource: sql`COALESCE(excluded.utm_source, ${formSubmissions.utmSource})`,
        utmMedium: sql`COALESCE(excluded.utm_medium, ${formSubmissions.utmMedium})`,
        utmCampaign: sql`COALESCE(excluded.utm_campaign, ${formSubmissions.utmCampaign})`,
        utmTerm: sql`COALESCE(excluded.utm_term, ${formSubmissions.utmTerm})`,
        utmContent: sql`COALESCE(excluded.utm_content, ${formSubmissions.utmContent})`,
        gclid: sql`COALESCE(excluded.gclid, ${formSubmissions.gclid})`,
        referrer: sql`COALESCE(excluded.referrer, ${formSubmissions.referrer})`,
        landingPath: sql`COALESCE(excluded.landing_path, ${formSubmissions.landingPath})`,

        viewport: sql`COALESCE(excluded.viewport, ${formSubmissions.viewport})`,
        screenWidth: sql`COALESCE(excluded.screen_width, ${formSubmissions.screenWidth})`,
        timezone: sql`COALESCE(excluded.timezone, ${formSubmissions.timezone})`,
        language: sql`COALESCE(excluded.language, ${formSubmissions.language})`,
        userAgent: sql`COALESCE(excluded.user_agent, ${formSubmissions.userAgent})`,

        updatedAt: sql`timezone('utc'::text, now())`,
      },
      // Rule 2: a beacon older than what we already stored is a no-op. The
      // route still returns 200 — discarding it is the expected outcome.
      // Tombstones (destroyed_at set) additionally reject EVERY beacon: the
      // PII-stripped row keeps the session_key occupied precisely so a late
      // beacon can't repopulate or resurrect a permanently deleted session.
      setWhere: sql`excluded.last_activity_at >= ${formSubmissions.lastActivityAt} AND ${formSubmissions.destroyedAt} IS NULL`,
    })
}

// R5 (offset variant): each allowlisted sort field maps to its ORDER BY
// column — offset pagination needs no cursor descriptors.
const SORT_COLUMNS = {
  received: formSubmissions.lastActivityAt,
} as const satisfies Record<SubmissionSortField, unknown>

export async function listFormSubmissions({
  offset,
  limit,
  sort = DEFAULT_SUBMISSIONS_SORT,
  ...filters
}: FormSubmissionFilters & {
  offset: number
  limit: number
  sort?: ParsedSort<SubmissionSortField>
}) {
  const direction = sort.direction === 'asc' ? asc : desc

  return db
    .select()
    .from(formSubmissions)
    .where(buildFilters(filters))
    // Id tie-breaker keeps offset pages stable when timestamps collide.
    .orderBy(direction(SORT_COLUMNS[sort.field]), direction(formSubmissions.id))
    .limit(limit)
    .offset(offset)
}

/**
 * D1 unacknowledged predicate — MUST stay in sync with
 * `isUnacknowledgedSubmission` in
 * apps/internal/lib/form-submissions/constants.ts. Served by the partial
 * index idx_form_submissions_unread (deleted_at IS NULL AND
 * acknowledged_at IS NULL), which covers the kind/status residual filter.
 */
export async function countUnacknowledgedFormSubmissions() {
  const [row] = await db
    .select({ value: count() })
    .from(formSubmissions)
    .where(
      and(
        isNull(formSubmissions.deletedAt),
        isNull(formSubmissions.acknowledgedAt),
        or(
          eq(formSubmissions.kind, 'contact'),
          inArray(formSubmissions.status, ['completed', 'captured'])
        )
      )
    )

  return row?.value ?? 0
}

export async function countFormSubmissions(filters: FormSubmissionFilters) {
  const [row] = await db
    .select({ value: count() })
    .from(formSubmissions)
    .where(buildFilters(filters))

  return row?.value ?? 0
}

/**
 * Cron sweep (/api/cron/abandon-stale-submissions): audits stuck at
 * `in_progress` whose last beacon is older than the cutoff flip to
 * `abandoned`. The client-side abandoned beacon rides `pagehide` and is
 * inherently lossy (killed tabs, mobile backgrounding, network loss), so
 * stale rows are expected, not exceptional.
 *
 * Race-free against late beacons by the same enum-rank rules as
 * `upsertFormSubmission`: `abandoned` outranks `in_progress` but sits below
 * `completed`/`captured`, so a delayed genuine beacon still advances the row
 * past this sweep, and a stale `in_progress` beacon can't regress it.
 *
 * `last_trigger: 'timeout'` distinguishes swept rows from beacon-reported
 * abandons in diagnostics. Deliberately does NOT touch `last_activity_at`
 * (the client-side beacon ordering key) or acknowledgement (in_progress rows
 * never flag).
 */
export async function abandonStaleFormSubmissions(cutoffHours: number) {
  const rows = await db
    .update(formSubmissions)
    .set({
      status: 'abandoned',
      lastTrigger: 'timeout',
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(
      and(
        eq(formSubmissions.kind, 'audit'),
        eq(formSubmissions.status, 'in_progress'),
        isNull(formSubmissions.deletedAt),
        isNull(formSubmissions.destroyedAt),
        sql`${formSubmissions.lastActivityAt} < timezone('utc'::text, now()) - make_interval(hours => ${cutoffHours})`
      )
    )
    .returning({ id: formSubmissions.id })

  return rows.length
}

/**
 * Idempotent: only sets acknowledgement if not already acknowledged, so a
 * double-click or two admins racing never overwrites the first reviewer.
 *
 * `expectedLastActivityAt` is the version token the admin actually SAW: if
 * a beacon advanced the row between render and click (the D8 re-flag case),
 * the UPDATE misses and the caller surfaces "changed since you viewed it"
 * instead of marking never-reviewed data as acknowledged.
 *
 * Returns the updated row, or null when nothing changed — callers
 * distinguish already-acknowledged from stale-version by re-fetching.
 */
export async function acknowledgeFormSubmission(
  id: string,
  userId: string,
  expectedLastActivityAt: string
) {
  const [row] = await db
    .update(formSubmissions)
    .set({
      acknowledgedAt: sql`timezone('utc'::text, now())`,
      acknowledgedBy: userId,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(
      and(
        eq(formSubmissions.id, id),
        isNull(formSubmissions.deletedAt),
        isNull(formSubmissions.acknowledgedAt),
        eq(formSubmissions.lastActivityAt, expectedLastActivityAt)
      )
    )
    .returning()

  return row ?? null
}

/**
 * Direction-guarded and idempotent like `acknowledgeFormSubmission`: archive
 * only touches active rows, restore only archived rows, so double-clicks and
 * racing admins produce exactly one state change. Returns the updated row or
 * null when nothing changed.
 */
export async function setFormSubmissionArchived(id: string, archived: boolean) {
  const [row] = await db
    .update(formSubmissions)
    .set({
      deletedAt: archived ? sql`timezone('utc'::text, now())` : null,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(
      and(
        eq(formSubmissions.id, id),
        // Tombstones are terminal — they can be neither archived nor
        // restored.
        isNull(formSubmissions.destroyedAt),
        archived
          ? isNull(formSubmissions.deletedAt)
          : isNotNull(formSubmissions.deletedAt)
      )
    )
    .returning()

  return row ?? null
}

/**
 * Reverse of `acknowledgeFormSubmission`, same idempotency contract: only
 * clears acknowledgement when one exists on an active row.
 */
export async function unacknowledgeFormSubmission(id: string) {
  const [row] = await db
    .update(formSubmissions)
    .set({
      acknowledgedAt: null,
      acknowledgedBy: null,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(
      and(
        eq(formSubmissions.id, id),
        isNull(formSubmissions.deletedAt),
        isNotNull(formSubmissions.acknowledgedAt)
      )
    )
    .returning()

  return row ?? null
}

/**
 * "Delete forever" — restricted to rows that are already archived (mirrors
 * the contacts archive-then-destroy flow). NOT a SQL DELETE: the row is
 * PII-stripped and tombstoned (`destroyed_at`) in the same transaction that
 * purges its SUBMISSION activity logs, because:
 *   1. Deleting the row would free its unique `session_key`, letting a late
 *      intake beacon resurrect the "deleted" session as a fresh row.
 *   2. The confirm dialog promises the history goes too — prior activity
 *      summaries embed the prospect's name/email.
 * The tombstone is invisible to every list/count, rejects all future
 * beacons, and can never be restored.
 */
export async function destroyFormSubmission(id: string) {
  return db.transaction(async tx => {
    const [row] = await tx
      .update(formSubmissions)
      .set({
        destroyedAt: sql`timezone('utc'::text, now())`,
        updatedAt: sql`timezone('utc'::text, now())`,

        // Strip every PII / payload field; only the skeleton (id,
        // session_key, kind, status, timing, source_detail) remains.
        lastTrigger: null,
        contactName: null,
        contactEmail: null,
        contactCompany: null,
        contactWebsite: null,
        subject: null,
        message: null,
        marketingConsent: null,
        responses: null,
        result: null,
        phaseId: null,
        topServiceId: null,
        posthogDistinctId: null,
        posthogSessionId: null,
        posthogReplayUrl: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
        gclid: null,
        referrer: null,
        landingPath: null,
        viewport: null,
        screenWidth: null,
        timezone: null,
        language: null,
        userAgent: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
      })
      .where(
        and(
          eq(formSubmissions.id, id),
          isNotNull(formSubmissions.deletedAt),
          isNull(formSubmissions.destroyedAt)
        )
      )
      .returning()

    if (!row) {
      return null
    }

    // The promised "and its history": hard-delete the submission's activity
    // rows — their summaries carry the prospect's name/email.
    await tx
      .delete(activityLogs)
      .where(
        and(
          eq(activityLogs.targetType, 'SUBMISSION'),
          eq(activityLogs.targetId, id)
        )
      )

    return row
  })
}

export async function getFormSubmissionById(
  id: string,
  { includeArchived = false }: { includeArchived?: boolean } = {}
) {
  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.id, id),
        includeArchived ? undefined : isNull(formSubmissions.deletedAt)
      )
    )
    .limit(1)

  return row ?? null
}
