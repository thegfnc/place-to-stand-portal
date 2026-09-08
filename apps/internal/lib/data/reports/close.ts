import 'server-only'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import {
  monthlyCloseClosedEvent,
  monthlyCloseReopenedEvent,
} from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  fetchLateRecords,
  getActiveSnapshot,
  hasActiveSnapshotForDate,
  insertSnapshot,
  softDeleteSnapshot,
} from '@/lib/queries/reports/close-snapshots'

import { fetchMonthlyCloseReport } from './monthly-close'
import { computeDeltas } from './close-drift'
import type { MonthlyCloseReport } from './types'

const SNAPSHOT_SCHEMA_VERSION = 1

// The snapshot shape and the pure snapshot-vs-live comparison live in
// ./close-drift so they can be exercised without a database or a session.

import type { CloseDriftDelta, SnapshotReport } from './close-drift'

// ---------------------------------------------------------------------------
// Snapshot payload validation (F9). The snapshot must decode without running
// live queries, and a shape mismatch must surface as an explicit error state
// — never a crash or a silent misread.
// ---------------------------------------------------------------------------

const payrollRowSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  updatedAt: z.string(),
  totalHours: z.number(),
  amount: z.number(),
})

const billingClientDetailSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  billingType: z.enum(['prepaid', 'net_30']),
  hours: z.number(),
  commission: z.number(),
})

const originationGroupRowSchema = z.object({
  originatorKind: z.enum(['user', 'contact']),
  originatorId: z.string(),
  originatorName: z.string(),
  originatorEmail: z.string(),
  originatorAvatarUrl: z.string().nullable(),
  originatorUpdatedAt: z.string().nullable(),
  clients: z.array(billingClientDetailSchema),
  totalHours: z.number(),
  totalCommission: z.number(),
})

const closerGroupRowSchema = z.object({
  closerUserId: z.string(),
  closerName: z.string().nullable(),
  closerEmail: z.string(),
  closerAvatarUrl: z.string().nullable(),
  closerUpdatedAt: z.string(),
  clients: z.array(billingClientDetailSchema),
  totalHours: z.number(),
  totalCommission: z.number(),
})

const partnerPayoutRowSchema = z.object({
  key: z.string(),
  kind: z.enum(['user', 'contact']),
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  avatarUpdatedAt: z.string().nullable(),
  payrollAmount: z.number(),
  originationAmount: z.number(),
  closerAmount: z.number(),
  totalAmount: z.number(),
})

const billingRowSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  totalHours: z.number(),
  amount: z.number(),
})

const ratesSchema = z.object({
  effectiveFrom: z.string(),
  billablePerHour: z.number(),
  payrollPerHour: z.number(),
  closerPerHour: z.number(),
  originationPerHour: z.number(),
  internalOriginationPayable: z.boolean(),
  housePerHour: z.number(),
})

const snapshotReportSchema = z.object({
  payroll: z.object({
    rows: z.array(payrollRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    hourlyRate: z.number(),
  }),
  origination: z.object({
    rows: z.array(originationGroupRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    commissionPerHour: z.number(),
  }),
  closer: z.object({
    rows: z.array(closerGroupRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    commissionPerHour: z.number(),
  }),
  partnerPayouts: z.object({
    rows: z.array(partnerPayoutRowSchema),
    totalPayroll: z.number(),
    totalOrigination: z.number(),
    totalCloser: z.number(),
    totalAmount: z.number(),
  }),
  prepaidBilling: z.object({
    rows: z.array(billingRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    hourlyRate: z.number(),
  }),
  net30Billing: z.object({
    rows: z.array(billingRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    hourlyRate: z.number(),
  }),
  house: z.object({
    billableHours: z.number(),
    ratePerHour: z.number(),
    totalAmount: z.number(),
  }),
  workBillableHours: z.number(),
  workBillableTotal: z.number(),
  combinedBillingTotal: z.number(),
  combinedPayoutTotal: z.number(),
  rates: ratesSchema,
})

const snapshotEnvelopeSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  report: snapshotReportSchema,
})

type SnapshotParseResult =
  | { ok: true; report: SnapshotReport }
  | { ok: false; error: string }

/**
 * Single decode point for persisted snapshots. Version 1 is identity; future
 * report-shape changes bump the version and migrate on read here. An unknown
 * version or failed parse returns an explicit error the UI renders as
 * "snapshot unreadable — reopen to re-derive".
 */
function parseSnapshotReport(payload: unknown): SnapshotParseResult {
  const parsed = snapshotEnvelopeSchema.safeParse(payload)

  if (!parsed.success) {
    const version =
      typeof payload === 'object' &&
      payload !== null &&
      'schemaVersion' in payload
        ? String((payload as { schemaVersion: unknown }).schemaVersion)
        : 'unknown'
    return {
      ok: false,
      error: `Snapshot is unreadable (schema version ${version}). Reopen the month to re-derive.`,
    }
  }

  return { ok: true, report: parsed.data.report }
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? `Month ${month}`} ${year}`
}

function monthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  const mm = String(month).padStart(2, '0')
  // Day 0 of the next month = last day of this month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

function isFuturePeriod(year: number, month: number): boolean {
  const now = new Date()
  return (
    year > now.getUTCFullYear() ||
    (year === now.getUTCFullYear() && month > now.getUTCMonth() + 1)
  )
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  if ((error as { code?: string }).code === '23505') {
    return true
  }
  // drizzle-orm wraps driver errors (DrizzleQueryError) with the original
  // PostgresError on `cause`.
  const cause = (error as { cause?: unknown }).cause
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { code?: string }).code === '23505'
  )
}

function toSnapshotEnvelope(report: MonthlyCloseReport): {
  schemaVersion: number
  report: SnapshotReport
} {
  // Cursors are global navigation bounds, always computed live — excluded.
  const { minCursor, maxCursor, ...rest } = report
  void minCursor
  void maxCursor
  return { schemaVersion: SNAPSHOT_SCHEMA_VERSION, report: rest }
}

export type CloseActionOutcome = { error?: string }

// ---------------------------------------------------------------------------
// Close / reopen / re-close
// ---------------------------------------------------------------------------

/**
 * Closes a month: captures the cutoff BEFORE deriving (any record committed
 * after `closedAt` is by definition detectable as late), derives the live
 * report, and freezes it. The partial unique index is the concurrency
 * backstop — a concurrent close surfaces as "already closed".
 */
export async function closeMonth(
  user: AppUser,
  params: { year: number; month: number }
): Promise<CloseActionOutcome> {
  assertAdmin(user)
  const { year, month } = params

  if (isFuturePeriod(year, month)) {
    return { error: 'Cannot close a month that has not started.' }
  }

  const closedAt = new Date().toISOString()
  const { startDate, endDate } = monthDateRange(year, month)
  const report = await fetchMonthlyCloseReport(startDate, endDate)

  let snapshotId: string | null = null
  try {
    snapshotId = await insertSnapshot(db, {
      year,
      month,
      report: toSnapshotEnvelope(report),
      closedAt,
      closedBy: user.id,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: 'This month is already closed.' }
    }
    console.error('Failed to close month', error)
    return { error: 'Unable to close this month. Please try again.' }
  }

  if (snapshotId) {
    const event = monthlyCloseClosedEvent({
      year,
      month,
      combinedBillingTotal: report.combinedBillingTotal,
      combinedPayoutTotal: report.combinedPayoutTotal,
    })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'MONTHLY_CLOSE',
      targetId: snapshotId,
      metadata: event.metadata,
    })
  }

  return {}
}

export async function reopenMonth(
  user: AppUser,
  params: { year: number; month: number }
): Promise<CloseActionOutcome> {
  assertAdmin(user)
  const { year, month } = params

  const deletedId = await softDeleteSnapshot(db, year, month)

  if (!deletedId) {
    return { error: 'This month is not closed.' }
  }

  const event = monthlyCloseReopenedEvent({ year, month })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'MONTHLY_CLOSE',
    targetId: deletedId,
    metadata: event.metadata,
  })

  return {}
}

/**
 * Atomic swap (F3), NOT sequential reopen→close: the replacement report is
 * derived first, then the old snapshot is soft-deleted and the new one
 * inserted in one transaction. A derivation or insert failure leaves the
 * original snapshot untouched — the month never transiently loses its close.
 */
export async function recloseMonth(
  user: AppUser,
  params: { year: number; month: number }
): Promise<CloseActionOutcome> {
  assertAdmin(user)
  const { year, month } = params

  const existing = await getActiveSnapshot(year, month)
  if (!existing) {
    return { error: 'This month is not closed.' }
  }

  const closedAt = new Date().toISOString()
  const { startDate, endDate } = monthDateRange(year, month)
  const report = await fetchMonthlyCloseReport(startDate, endDate)

  let snapshotId: string | null = null
  try {
    snapshotId = await db.transaction(async tx => {
      await softDeleteSnapshot(tx, year, month)
      return insertSnapshot(tx, {
        year,
        month,
        report: toSnapshotEnvelope(report),
        closedAt,
        closedBy: user.id,
      })
    })
  } catch (error) {
    console.error('Failed to re-close month', error)
    return { error: 'Unable to re-close this month. Please try again.' }
  }

  if (snapshotId) {
    const event = monthlyCloseClosedEvent({
      year,
      month,
      combinedBillingTotal: report.combinedBillingTotal,
      combinedPayoutTotal: report.combinedPayoutTotal,
    })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'MONTHLY_CLOSE',
      targetId: snapshotId,
      metadata: event.metadata,
    })
  }

  return {}
}

/**
 * True when the month containing `date` ('yyyy-MM-dd') has an active close.
 * Gates billing-basis rewrites (hard block) and powers write-time warnings.
 */
export async function isMonthClosed(date: string): Promise<boolean> {
  return hasActiveSnapshotForDate(date)
}

/**
 * Non-blocking closed-month warning for time-log/hour-block writes (D9).
 * Checks every provided date and warns on the first closed month found.
 */
export async function closedMonthWarning(
  user: AppUser,
  dates: Array<string | null | undefined>
): Promise<string | undefined> {
  assertAdmin(user)

  const months = new Set<string>()
  for (const date of dates) {
    if (date) {
      months.add(date.slice(0, 7))
    }
  }

  for (const month of months) {
    const monthStart = `${month}-01`
    if (await isMonthClosed(monthStart)) {
      const [year, mm] = month.split('-').map(Number)
      return `${periodLabel(year, mm)} is closed — this change will show as drift on the Monthly Close Report until it is reopened and re-closed.`
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Snapshot-aware report view + drift detection (F2/F8)
// ---------------------------------------------------------------------------

type CloseDriftLateRecord = {
  kind: 'time_log' | 'hour_block'
  id: string
  clientName: string | null
  hours: number
  eventDate: string
  recordedAt: string
  change: 'added' | 'modified' | 'deleted'
}

export type CloseDrift = {
  hasDrift: boolean
  deltas: CloseDriftDelta[]
  lateRecords: CloseDriftLateRecord[]
}

export type MonthlyCloseView = {
  report: MonthlyCloseReport
  close: {
    status: 'open' | 'closed'
    closedAt?: string
    closedByName?: string | null
    /** Set when the persisted snapshot failed validation (F9). */
    snapshotError?: string
    drift?: CloseDrift | null
  }
}

async function computeDrift(
  snapshot: SnapshotReport,
  live: MonthlyCloseReport,
  params: { year: number; month: number; closedAt: string }
): Promise<CloseDrift> {
  const deltas = computeDeltas(snapshot, live)
  const { startDate, endDate } = monthDateRange(params.year, params.month)
  const lateRows = await fetchLateRecords(startDate, endDate, params.closedAt)

  const lateRecords: CloseDriftLateRecord[] = lateRows.map(row => {
    const change: CloseDriftLateRecord['change'] =
      row.deletedAt && row.deletedAt > params.closedAt
        ? 'deleted'
        : row.createdAt > params.closedAt
          ? 'added'
          : 'modified'

    return {
      kind: row.kind,
      id: row.id,
      clientName: row.clientName,
      hours: Number(row.hours),
      eventDate: row.eventDate,
      recordedAt:
        change === 'deleted'
          ? (row.deletedAt ?? row.updatedAt)
          : change === 'added'
            ? row.createdAt
            : row.updatedAt,
      change,
    }
  })

  // hasDrift is driven by the canonical comparison; lateRecords is
  // best-effort attribution (a billing-term or partner change produces a
  // delta with no matching record).
  return { hasDrift: deltas.length > 0, deltas, lateRecords }
}

/**
 * Snapshot-aware report fetch: open months render live; closed months render
 * the frozen snapshot (with live navigation cursors) plus a live-vs-snapshot
 * drift computation.
 */
export async function fetchMonthlyCloseView(
  year: number,
  month: number
): Promise<MonthlyCloseView> {
  const { startDate, endDate } = monthDateRange(year, month)
  // Always derived: cursors for month navigation, and the live half of the
  // drift comparison. React cache() dedupes within the request.
  const live = await fetchMonthlyCloseReport(startDate, endDate)

  const snapshot = await getActiveSnapshot(year, month)

  if (!snapshot) {
    return { report: live, close: { status: 'open' } }
  }

  const parsed = parseSnapshotReport(snapshot.report)

  if (!parsed.ok) {
    return {
      report: live,
      close: {
        status: 'closed',
        closedAt: snapshot.closedAt,
        closedByName: snapshot.closedByName,
        snapshotError: parsed.error,
        drift: null,
      },
    }
  }

  const drift = await computeDrift(parsed.report, live, {
    year,
    month,
    closedAt: snapshot.closedAt,
  })

  return {
    report: {
      ...parsed.report,
      minCursor: live.minCursor,
      maxCursor: live.maxCursor,
    },
    close: {
      status: 'closed',
      closedAt: snapshot.closedAt,
      closedByName: snapshot.closedByName,
      drift,
    },
  }
}
