import 'server-only'

import { aliasedTable, and, eq, gte, isNull, lte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients,
  contacts,
  hourBlocks,
  projects,
  timeLogs,
  users,
} from '@/lib/db/schema'
import { billingTypeAsOfSql } from '@/lib/queries/clients/billing-terms'
import type { MonthCursor } from '@/lib/data/reports/types'

/**
 * Billing type is resolved AS OF the report period (PRD 002 D4) — the newest
 * `client_billing_terms.effective_from` <= period start wins, so editing a
 * client's billing type never rewrites already-rendered historical months.
 * NULL resolution (no term at or before the period) fails both comparisons
 * and excludes the client from that month.
 */
function isPrepaidAsOf(periodStart: string) {
  return sql`${billingTypeAsOfSql(periodStart)} = 'prepaid'`
}

function isNet30AsOf(periodStart: string) {
  return sql`${billingTypeAsOfSql(periodStart)} = 'net_30'`
}

type PayrollQueryRow = {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  updatedAt: string
  totalHours: string | null
}

type OriginatorKind = 'user' | 'contact'

export type OriginationQueryRow = {
  originatorKind: OriginatorKind
  originatorId: string
  originatorName: string
  originatorEmail: string
  /** Populated only for user originators so we can render their avatar. */
  originatorAvatarUrl: string | null
  originatorUpdatedAt: string | null
  clientId: string
  clientName: string
  clientBillingType: 'prepaid' | 'net_30'
  hours: string | null
}

export type CloserQueryRow = {
  closerUserId: string
  closerName: string | null
  closerEmail: string
  closerAvatarUrl: string | null
  closerUpdatedAt: string
  clientId: string
  clientName: string
  clientBillingType: 'prepaid' | 'net_30'
  hours: string | null
}

type PrepaidBillingQueryRow = {
  clientId: string
  clientName: string
  totalHours: string | null
}

type Net30QueryRow = {
  clientId: string
  clientName: string
  totalHours: string | null
}

/**
 * Fetches employee payroll data for ADMIN users who logged time on CLIENT
 * projects in the given date range. Non-client time (PERSONAL, INTERNAL) is
 * excluded because it isn't billable and therefore can't fund a payroll
 * payout from the partner formula.
 *
 * Returns raw hours — the caller multiplies by the period's payroll rate
 * from the partner rate schedule.
 */
export async function fetchEmployeePayroll(
  startDate: string,
  endDate: string
): Promise<PayrollQueryRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      updatedAt: users.updatedAt,
      totalHours: sql<string | null>`SUM(${timeLogs.hours})`,
    })
    .from(timeLogs)
    .innerJoin(users, eq(timeLogs.userId, users.id))
    .innerJoin(projects, eq(projects.id, timeLogs.projectId))
    .where(
      and(
        eq(users.role, 'ADMIN'),
        eq(projects.type, 'CLIENT'),
        isNull(timeLogs.deletedAt),
        isNull(users.deletedAt),
        isNull(projects.deletedAt),
        gte(timeLogs.loggedOn, startDate),
        lte(timeLogs.loggedOn, endDate)
      )
    )
    .groupBy(
      users.id,
      users.fullName,
      users.email,
      users.avatarUrl,
      users.updatedAt
    )

  return rows as PayrollQueryRow[]
}

/**
 * Fetches the total billable work hours (admin hours logged on CLIENT
 * projects) for the period — the "accrual" basis that grounds all partner
 * payouts. This is the denominator for the work-billable reconciliation:
 * work_billable_total × billablePerHour = Payroll + Origination + Closer + House
 */
export async function fetchBillableWorkHours(
  startDate: string,
  endDate: string
): Promise<number> {
  const [row] = await db
    .select({
      totalHours: sql<string | null>`SUM(${timeLogs.hours})`,
    })
    .from(timeLogs)
    .innerJoin(users, eq(timeLogs.userId, users.id))
    .innerJoin(projects, eq(projects.id, timeLogs.projectId))
    .where(
      and(
        eq(users.role, 'ADMIN'),
        eq(projects.type, 'CLIENT'),
        isNull(timeLogs.deletedAt),
        isNull(users.deletedAt),
        isNull(projects.deletedAt),
        gte(timeLogs.loggedOn, startDate),
        lte(timeLogs.loggedOn, endDate)
      )
    )

  const parsed = Number(row?.totalHours ?? '0')
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Fetches origination commission rows on a BILLING basis — the same
 * population we count for "Billing In":
 *
 *   Prepaid → hour_blocks.hours_purchased (when the block is billed)
 *   Net_30  → time_logs.hours on net_30 client projects (when work is logged)
 *
 * Payroll and Closer stay on a work-basis (time_logs on client projects);
 * Origination is bound to cash events because the firm pays originators
 * out of incoming billing, not out of accrued work. This means the payouts
 * side of the monthly close no longer perfectly reconciles with
 * work_billable_total — that's expected and is reflected in the House card
 * being a cash-flow residual of `Billing In − Total Payouts`.
 *
 * Runs 4 queries in parallel:
 *   1. Prepaid × user-originated (from hour_blocks)
 *   2. Prepaid × contact-originated (from hour_blocks)
 *   3. Net_30 × user-originated (from time_logs via projects)
 *   4. Net_30 × contact-originated (from time_logs via projects)
 */
export async function fetchOriginationCommissions(
  startDate: string,
  endDate: string
): Promise<OriginationQueryRow[]> {
  const [prepaidUser, prepaidContact, net30User, net30Contact] =
    await Promise.all([
      // 1. Prepaid + internal user originator (from hour_blocks)
      db
        .select({
          originatorId: users.id,
          originatorName: users.fullName,
          originatorEmail: users.email,
          originatorAvatarUrl: users.avatarUrl,
          originatorUpdatedAt: users.updatedAt,
          clientId: clients.id,
          clientName: clients.name,
          hours: sql<string | null>`SUM(${hourBlocks.hoursPurchased})`,
        })
        .from(hourBlocks)
        .innerJoin(clients, eq(hourBlocks.clientId, clients.id))
        .innerJoin(users, eq(clients.originationUserId, users.id))
        .where(
          and(
            isPrepaidAsOf(startDate),
            isNull(hourBlocks.deletedAt),
            isNull(clients.deletedAt),
            isNull(users.deletedAt),
            gte(hourBlocks.billingMonth, startDate),
            lte(hourBlocks.billingMonth, endDate)
          )
        )
        .groupBy(
          users.id,
          users.fullName,
          users.email,
          users.avatarUrl,
          users.updatedAt,
          clients.id,
          clients.name
        ),

      // 2. Prepaid + external contact referrer (from hour_blocks)
      db
        .select({
          originatorId: contacts.id,
          originatorName: contacts.name,
          originatorEmail: contacts.email,
          clientId: clients.id,
          clientName: clients.name,
          hours: sql<string | null>`SUM(${hourBlocks.hoursPurchased})`,
        })
        .from(hourBlocks)
        .innerJoin(clients, eq(hourBlocks.clientId, clients.id))
        .innerJoin(contacts, eq(clients.originationContactId, contacts.id))
        .where(
          and(
            isPrepaidAsOf(startDate),
            isNull(hourBlocks.deletedAt),
            isNull(clients.deletedAt),
            isNull(contacts.deletedAt),
            gte(hourBlocks.billingMonth, startDate),
            lte(hourBlocks.billingMonth, endDate)
          )
        )
        .groupBy(
          contacts.id,
          contacts.name,
          contacts.email,
          clients.id,
          clients.name
        ),

      // 3. Net_30 + internal user originator (from time_logs on client projects)
      db
        .select({
          originatorId: users.id,
          originatorName: users.fullName,
          originatorEmail: users.email,
          originatorAvatarUrl: users.avatarUrl,
          originatorUpdatedAt: users.updatedAt,
          clientId: clients.id,
          clientName: clients.name,
          hours: sql<string | null>`SUM(${timeLogs.hours})`,
        })
        .from(timeLogs)
        .innerJoin(projects, eq(timeLogs.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .innerJoin(users, eq(clients.originationUserId, users.id))
        .where(
          and(
            isNet30AsOf(startDate),
            eq(projects.type, 'CLIENT'),
            isNull(timeLogs.deletedAt),
            isNull(projects.deletedAt),
            isNull(clients.deletedAt),
            isNull(users.deletedAt),
            gte(timeLogs.loggedOn, startDate),
            lte(timeLogs.loggedOn, endDate)
          )
        )
        .groupBy(
          users.id,
          users.fullName,
          users.email,
          users.avatarUrl,
          users.updatedAt,
          clients.id,
          clients.name
        ),

      // 4. Net_30 + external contact referrer (from time_logs on client projects)
      db
        .select({
          originatorId: contacts.id,
          originatorName: contacts.name,
          originatorEmail: contacts.email,
          clientId: clients.id,
          clientName: clients.name,
          hours: sql<string | null>`SUM(${timeLogs.hours})`,
        })
        .from(timeLogs)
        .innerJoin(projects, eq(timeLogs.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .innerJoin(contacts, eq(clients.originationContactId, contacts.id))
        .where(
          and(
            isNet30AsOf(startDate),
            eq(projects.type, 'CLIENT'),
            isNull(timeLogs.deletedAt),
            isNull(projects.deletedAt),
            isNull(clients.deletedAt),
            isNull(contacts.deletedAt),
            gte(timeLogs.loggedOn, startDate),
            lte(timeLogs.loggedOn, endDate)
          )
        )
        .groupBy(
          contacts.id,
          contacts.name,
          contacts.email,
          clients.id,
          clients.name
        ),
    ])

  const rows: OriginationQueryRow[] = []

  for (const row of prepaidUser) {
    rows.push({
      originatorKind: 'user',
      originatorId: row.originatorId,
      originatorName: row.originatorName ?? row.originatorEmail,
      originatorEmail: row.originatorEmail,
      originatorAvatarUrl: row.originatorAvatarUrl,
      originatorUpdatedAt: row.originatorUpdatedAt,
      clientId: row.clientId,
      clientName: row.clientName,
      clientBillingType: 'prepaid',
      hours: row.hours,
    })
  }
  for (const row of prepaidContact) {
    rows.push({
      originatorKind: 'contact',
      originatorId: row.originatorId,
      originatorName: row.originatorName ?? row.originatorEmail,
      originatorEmail: row.originatorEmail,
      originatorAvatarUrl: null,
      originatorUpdatedAt: null,
      clientId: row.clientId,
      clientName: row.clientName,
      clientBillingType: 'prepaid',
      hours: row.hours,
    })
  }
  for (const row of net30User) {
    rows.push({
      originatorKind: 'user',
      originatorId: row.originatorId,
      originatorName: row.originatorName ?? row.originatorEmail,
      originatorEmail: row.originatorEmail,
      originatorAvatarUrl: row.originatorAvatarUrl,
      originatorUpdatedAt: row.originatorUpdatedAt,
      clientId: row.clientId,
      clientName: row.clientName,
      clientBillingType: 'net_30',
      hours: row.hours,
    })
  }
  for (const row of net30Contact) {
    rows.push({
      originatorKind: 'contact',
      originatorId: row.originatorId,
      originatorName: row.originatorName ?? row.originatorEmail,
      originatorEmail: row.originatorEmail,
      originatorAvatarUrl: null,
      originatorUpdatedAt: null,
      clientId: row.clientId,
      clientName: row.clientName,
      clientBillingType: 'net_30',
      hours: row.hours,
    })
  }

  return rows
}

/**
 * Fetches closer commission rows on the same BILLING basis as
 * `fetchOriginationCommissions`. Closers are paid out of cash events, not
 * accrued work.
 *
 *   Prepaid → hour_blocks.hours_purchased
 *   Net_30  → time_logs.hours on net_30 client projects
 *
 * Closer is always an internal admin user (no contact branch).
 */
export async function fetchCloserCommissions(
  startDate: string,
  endDate: string
): Promise<CloserQueryRow[]> {
  const closerUsers = aliasedTable(users, 'closer_users')

  const [prepaid, net30] = await Promise.all([
    // Prepaid: hour_blocks grouped by closer
    db
      .select({
        closerUserId: closerUsers.id,
        closerName: closerUsers.fullName,
        closerEmail: closerUsers.email,
        closerAvatarUrl: closerUsers.avatarUrl,
        closerUpdatedAt: closerUsers.updatedAt,
        clientId: clients.id,
        clientName: clients.name,
        hours: sql<string | null>`SUM(${hourBlocks.hoursPurchased})`,
      })
      .from(hourBlocks)
      .innerJoin(clients, eq(hourBlocks.clientId, clients.id))
      .innerJoin(closerUsers, eq(clients.closerUserId, closerUsers.id))
      .where(
        and(
          isPrepaidAsOf(startDate),
          isNull(hourBlocks.deletedAt),
          isNull(clients.deletedAt),
          isNull(closerUsers.deletedAt),
          gte(hourBlocks.billingMonth, startDate),
          lte(hourBlocks.billingMonth, endDate)
        )
      )
      .groupBy(
        closerUsers.id,
        closerUsers.fullName,
        closerUsers.email,
        closerUsers.avatarUrl,
        closerUsers.updatedAt,
        clients.id,
        clients.name
      ),

    // Net_30: time_logs on client projects grouped by closer
    db
      .select({
        closerUserId: closerUsers.id,
        closerName: closerUsers.fullName,
        closerEmail: closerUsers.email,
        closerAvatarUrl: closerUsers.avatarUrl,
        closerUpdatedAt: closerUsers.updatedAt,
        clientId: clients.id,
        clientName: clients.name,
        hours: sql<string | null>`SUM(${timeLogs.hours})`,
      })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .innerJoin(closerUsers, eq(clients.closerUserId, closerUsers.id))
      .where(
        and(
          isNet30AsOf(startDate),
          eq(projects.type, 'CLIENT'),
          isNull(timeLogs.deletedAt),
          isNull(projects.deletedAt),
          isNull(clients.deletedAt),
          isNull(closerUsers.deletedAt),
          gte(timeLogs.loggedOn, startDate),
          lte(timeLogs.loggedOn, endDate)
        )
      )
      .groupBy(
        closerUsers.id,
        closerUsers.fullName,
        closerUsers.email,
        closerUsers.avatarUrl,
        closerUsers.updatedAt,
        clients.id,
        clients.name
      ),
  ])

  const rows: CloserQueryRow[] = []

  for (const row of prepaid) {
    rows.push({
      closerUserId: row.closerUserId,
      closerName: row.closerName,
      closerEmail: row.closerEmail,
      closerAvatarUrl: row.closerAvatarUrl,
      closerUpdatedAt: row.closerUpdatedAt,
      clientId: row.clientId,
      clientName: row.clientName,
      clientBillingType: 'prepaid',
      hours: row.hours,
    })
  }
  for (const row of net30) {
    rows.push({
      closerUserId: row.closerUserId,
      closerName: row.closerName,
      closerEmail: row.closerEmail,
      closerAvatarUrl: row.closerAvatarUrl,
      closerUpdatedAt: row.closerUpdatedAt,
      clientId: row.clientId,
      clientName: row.clientName,
      clientBillingType: 'net_30',
      hours: row.hours,
    })
  }

  return rows
}

/**
 * Fetches billing data for prepaid clients based on hour blocks purchased in
 * the given date range. Returns raw hours — the caller multiplies by the
 * period's billable rate from the partner rate schedule.
 */
export async function fetchPrepaidBilling(
  startDate: string,
  endDate: string
): Promise<PrepaidBillingQueryRow[]> {
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      totalHours: sql<string | null>`SUM(${hourBlocks.hoursPurchased})`,
    })
    .from(hourBlocks)
    .innerJoin(clients, eq(hourBlocks.clientId, clients.id))
    .where(
      and(
        isPrepaidAsOf(startDate),
        isNull(hourBlocks.deletedAt),
        isNull(clients.deletedAt),
        gte(hourBlocks.billingMonth, startDate),
        lte(hourBlocks.billingMonth, endDate)
      )
    )
    .groupBy(clients.id, clients.name)

  return rows as PrepaidBillingQueryRow[]
}

/**
 * Fetches billing data for net_30 clients based on time logged in the given
 * date range. Returns raw hours — the caller multiplies by the period's
 * billable rate from the partner rate schedule.
 */
export async function fetchNet30Billing(
  startDate: string,
  endDate: string
): Promise<Net30QueryRow[]> {
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      totalHours: sql<string | null>`SUM(${timeLogs.hours})`,
    })
    .from(timeLogs)
    .innerJoin(projects, eq(timeLogs.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(
        isNet30AsOf(startDate),
        // Every other net_30 query (origination, closer) scopes to CLIENT
        // projects. Without it this one counts hours the commission sections
        // never see, inflating Billing In and House against nothing.
        eq(projects.type, 'CLIENT'),
        isNull(timeLogs.deletedAt),
        isNull(projects.deletedAt),
        isNull(clients.deletedAt),
        gte(timeLogs.loggedOn, startDate),
        lte(timeLogs.loggedOn, endDate)
      )
    )
    .groupBy(clients.id, clients.name)

  return rows as Net30QueryRow[]
}

/**
 * Fetches the date bounds for the report based on earliest data across all
 * sources. Returns min cursor (earliest month with data) and max cursor
 * (current month).
 */
export async function fetchReportDateBounds(): Promise<{
  min: MonthCursor
  max: MonthCursor
}> {
  // UTC throughout, matching monthDateRange/isFuturePeriod/currentMonthStartUtc.
  // Reading local getters here disagreed with those on the last hours of a
  // month in a negative-offset timezone.
  const now = new Date()
  const currentCursor: MonthCursor = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1, // Convert 0-indexed to 1-indexed
  }

  // Find earliest time log date
  const [timeLogRow] = await db
    .select({
      earliestDate: sql<string | null>`MIN(${timeLogs.loggedOn})`,
    })
    .from(timeLogs)
    .where(isNull(timeLogs.deletedAt))
    .limit(1)

  // Find earliest hour block billing month (PRD 002 D13 attribution)
  const [hourBlockRow] = await db
    .select({
      earliestDate: sql<string | null>`MIN(${hourBlocks.billingMonth})`,
    })
    .from(hourBlocks)
    .where(isNull(hourBlocks.deletedAt))
    .limit(1)

  // Parse dates and find the overall minimum.
  //
  // These come from raw `MIN(<date column>)` expressions, so postgres.js
  // applies its own date parser and hands back a Date at UTC midnight rather
  // than the declared string. Reading it with local getters rolls back a day
  // in any negative-offset timezone, which moved the earliest cursor into the
  // previous month whenever the first record fell on the 1st — silently
  // hiding a month from the report navigation. Read in UTC to match the
  // stored calendar date. (Handles a plain 'YYYY-MM-DD' string too: that also
  // parses as UTC midnight.)
  const dates: Date[] = []

  for (const value of [timeLogRow?.earliestDate, hourBlockRow?.earliestDate]) {
    if (!value) {
      continue
    }
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      dates.push(parsed)
    }
  }

  // If no data found, return current month for both
  if (dates.length === 0) {
    return { min: currentCursor, max: currentCursor }
  }

  // Find the earliest date
  const earliestDate = dates.reduce((a, b) => (a < b ? a : b))

  const minCursor: MonthCursor = {
    year: earliestDate.getUTCFullYear(),
    month: earliestDate.getUTCMonth() + 1,
  }

  // Don't allow future months
  if (compareMonthCursor(minCursor, currentCursor) > 0) {
    return { min: currentCursor, max: currentCursor }
  }

  return { min: minCursor, max: currentCursor }
}

function compareMonthCursor(a: MonthCursor, b: MonthCursor): number {
  const aValue = a.year * 12 + (a.month - 1)
  const bValue = b.year * 12 + (b.month - 1)

  if (aValue < bValue) return -1
  if (aValue > bValue) return 1
  return 0
}
