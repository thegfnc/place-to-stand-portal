import 'server-only'

import { cache } from 'react'

import { getPartnerRatesForPeriod } from '@/lib/billing/partner-rates'
import {
  fetchBillableWorkHours,
  fetchCloserCommissions,
  fetchEmployeePayroll,
  fetchNet30Billing,
  fetchOriginationCommissions,
  fetchPrepaidBilling,
  fetchReportDateBounds,
} from '@/lib/queries/reports/monthly-close'
import type {
  CloserClientDetail,
  CloserData,
  CloserGroupRow,
  HouseData,
  MonthlyCloseReport,
  Net30Data,
  Net30Row,
  OriginationClientDetail,
  OriginationData,
  OriginationGroupRow,
  PartnerPayoutData,
  PartnerPayoutRow,
  PayrollData,
  PayrollRow,
  PrepaidBillingData,
  PrepaidBillingRow,
} from './types'

/** Hours are NUMERIC(8,2) — settle float noise before comparing/subtracting. */
const round2 = (value: number): number => Math.round(value * 100) / 100

function toFiniteNumber(value: string | number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * Fetches and assembles the complete Monthly Close Report for a date range.
 * All split rates are read from the partner rate schedule based on the
 * period's start date, so historical months render at the rates that were in
 * effect at the time.
 *
 * @param startDate - Start date in 'yyyy-MM-dd' format (inclusive)
 * @param endDate - End date in 'yyyy-MM-dd' format (inclusive)
 */
export const fetchMonthlyCloseReport = cache(
  async (startDate: string, endDate: string): Promise<MonthlyCloseReport> => {
    const rates = getPartnerRatesForPeriod(startDate)

    // Fetch all data sources in parallel
    const [
      payrollRows,
      originationRows,
      closerRows,
      prepaidRows,
      net30Rows,
      billableWorkHours,
      bounds,
    ] = await Promise.all([
      fetchEmployeePayroll(startDate, endDate),
      fetchOriginationCommissions(startDate, endDate),
      fetchCloserCommissions(startDate, endDate),
      fetchPrepaidBilling(startDate, endDate),
      fetchNet30Billing(startDate, endDate),
      fetchBillableWorkHours(startDate, endDate),
      fetchReportDateBounds(),
    ])

    // ------------------------------------------------------------------
    // Payroll
    // ------------------------------------------------------------------
    const payrollData: PayrollRow[] = payrollRows.map(row => {
      const totalHours = toFiniteNumber(row.totalHours)
      return {
        userId: row.userId,
        fullName: row.fullName,
        email: row.email,
        avatarUrl: row.avatarUrl,
        updatedAt: row.updatedAt,
        totalHours,
        amount: totalHours * rates.payrollPerHour,
      }
    })

    const payrollTotalHours = payrollData.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const payroll: PayrollData = {
      rows: payrollData,
      totalHours: payrollTotalHours,
      totalAmount: payrollTotalHours * rates.payrollPerHour,
      hourlyRate: rates.payrollPerHour,
    }

    // ------------------------------------------------------------------
    // Origination — group rows from all 4 sub-queries by `${kind}:${id}`
    // so a single originator with both prepaid AND net_30 clients rolls
    // into one row.
    // ------------------------------------------------------------------
    const originatorMap = new Map<
      string,
      {
        originatorKind: 'user' | 'contact'
        originatorId: string
        originatorName: string
        originatorEmail: string
        originatorAvatarUrl: string | null
        originatorUpdatedAt: string | null
        clients: OriginationClientDetail[]
      }
    >()

    for (const row of originationRows) {
      // Pre-cutover: internal-user originators were not paid out — the
      // commission they would have earned is absorbed by the residual
      // house. Drop those rows before grouping so they don't appear in
      // the origination section, the rollup total, or the partner-payouts
      // aggregate.
      if (row.originatorKind === 'user' && !rates.internalOriginationPayable) {
        continue
      }

      const key = `${row.originatorKind}:${row.originatorId}`
      const hours = toFiniteNumber(row.hours)
      const detail: OriginationClientDetail = {
        clientId: row.clientId,
        clientName: row.clientName,
        billingType: row.clientBillingType,
        hours,
        commission: hours * rates.originationPerHour,
      }

      const existing = originatorMap.get(key)
      if (existing) {
        existing.clients.push(detail)
      } else {
        originatorMap.set(key, {
          originatorKind: row.originatorKind,
          originatorId: row.originatorId,
          originatorName: row.originatorName,
          originatorEmail: row.originatorEmail,
          originatorAvatarUrl: row.originatorAvatarUrl,
          originatorUpdatedAt: row.originatorUpdatedAt,
          clients: [detail],
        })
      }
    }

    const originationGroupRows: OriginationGroupRow[] = Array.from(
      originatorMap.values()
    ).map(group => {
      const totalHours = group.clients.reduce(
        (sum, c) => sum + c.hours,
        0
      )
      return {
        originatorKind: group.originatorKind,
        originatorId: group.originatorId,
        originatorName: group.originatorName,
        originatorEmail: group.originatorEmail,
        originatorAvatarUrl: group.originatorAvatarUrl,
        originatorUpdatedAt: group.originatorUpdatedAt,
        clients: group.clients,
        totalHours,
        totalCommission: totalHours * rates.originationPerHour,
      }
    })

    const originationTotalHours = originationGroupRows.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const origination: OriginationData = {
      rows: originationGroupRows,
      totalHours: originationTotalHours,
      totalAmount: originationTotalHours * rates.originationPerHour,
      commissionPerHour: rates.originationPerHour,
    }

    // ------------------------------------------------------------------
    // Closer — same pattern, grouped by closer user.
    // ------------------------------------------------------------------
    const closerMap = new Map<
      string,
      {
        closerUserId: string
        closerName: string | null
        closerEmail: string
        closerAvatarUrl: string | null
        closerUpdatedAt: string
        clients: CloserClientDetail[]
      }
    >()

    for (const row of closerRows) {
      const hours = toFiniteNumber(row.hours)
      const detail: CloserClientDetail = {
        clientId: row.clientId,
        clientName: row.clientName,
        billingType: row.clientBillingType,
        hours,
        commission: hours * rates.closerPerHour,
      }

      const existing = closerMap.get(row.closerUserId)
      if (existing) {
        existing.clients.push(detail)
      } else {
        closerMap.set(row.closerUserId, {
          closerUserId: row.closerUserId,
          closerName: row.closerName,
          closerEmail: row.closerEmail,
          closerAvatarUrl: row.closerAvatarUrl,
          closerUpdatedAt: row.closerUpdatedAt,
          clients: [detail],
        })
      }
    }

    const closerGroupRows: CloserGroupRow[] = Array.from(
      closerMap.values()
    ).map(group => {
      const totalHours = group.clients.reduce((sum, c) => sum + c.hours, 0)
      return {
        closerUserId: group.closerUserId,
        closerName: group.closerName,
        closerEmail: group.closerEmail,
        closerAvatarUrl: group.closerAvatarUrl,
        closerUpdatedAt: group.closerUpdatedAt,
        clients: group.clients,
        totalHours,
        totalCommission: totalHours * rates.closerPerHour,
      }
    })

    const closerTotalHours = closerGroupRows.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const closer: CloserData = {
      rows: closerGroupRows,
      totalHours: closerTotalHours,
      totalAmount: closerTotalHours * rates.closerPerHour,
      commissionPerHour: rates.closerPerHour,
    }

    // ------------------------------------------------------------------
    // Partner Payouts — lump-sum view by payee
    //
    // Merges Payroll (user), Origination (user or contact), and Closer
    // (user) into a single "cut a check for this amount" row per person.
    // Keyed on `${kind}:${id}` so users and contacts with the same UUID
    // don't collide.
    // ------------------------------------------------------------------
    const payeeMap = new Map<
      string,
      {
        key: string
        kind: 'user' | 'contact'
        id: string
        name: string
        email: string
        avatarUrl: string | null
        avatarUpdatedAt: string | null
        payrollAmount: number
        originationAmount: number
        closerAmount: number
      }
    >()

    const upsertPayee = (init: {
      kind: 'user' | 'contact'
      id: string
      name: string
      email: string
      avatarUrl: string | null
      avatarUpdatedAt: string | null
    }) => {
      const key = `${init.kind}:${init.id}`
      const existing = payeeMap.get(key)
      if (existing) {
        // Prefer the first non-null avatar we encountered.
        if (!existing.avatarUrl && init.avatarUrl) {
          existing.avatarUrl = init.avatarUrl
          existing.avatarUpdatedAt = init.avatarUpdatedAt
        }
        return existing
      }
      const next = {
        key,
        kind: init.kind,
        id: init.id,
        name: init.name,
        email: init.email,
        avatarUrl: init.avatarUrl,
        avatarUpdatedAt: init.avatarUpdatedAt,
        payrollAmount: 0,
        originationAmount: 0,
        closerAmount: 0,
      }
      payeeMap.set(key, next)
      return next
    }

    for (const row of payroll.rows) {
      const payee = upsertPayee({
        kind: 'user',
        id: row.userId,
        name: row.fullName ?? row.email,
        email: row.email,
        avatarUrl: row.avatarUrl,
        avatarUpdatedAt: row.updatedAt,
      })
      payee.payrollAmount += row.amount
    }
    for (const row of origination.rows) {
      const payee = upsertPayee({
        kind: row.originatorKind,
        id: row.originatorId,
        name: row.originatorName,
        email: row.originatorEmail,
        avatarUrl: row.originatorAvatarUrl,
        avatarUpdatedAt: row.originatorUpdatedAt,
      })
      payee.originationAmount += row.totalCommission
    }
    for (const row of closer.rows) {
      const payee = upsertPayee({
        kind: 'user',
        id: row.closerUserId,
        name: row.closerName ?? row.closerEmail,
        email: row.closerEmail,
        avatarUrl: row.closerAvatarUrl,
        avatarUpdatedAt: row.closerUpdatedAt,
      })
      payee.closerAmount += row.totalCommission
    }

    const partnerPayoutRows: PartnerPayoutRow[] = Array.from(
      payeeMap.values()
    )
      .map(p => ({
        key: p.key,
        kind: p.kind,
        id: p.id,
        name: p.name,
        email: p.email,
        avatarUrl: p.avatarUrl,
        avatarUpdatedAt: p.avatarUpdatedAt,
        payrollAmount: p.payrollAmount,
        originationAmount: p.originationAmount,
        closerAmount: p.closerAmount,
        totalAmount: p.payrollAmount + p.originationAmount + p.closerAmount,
      }))
      // Biggest check first — bookkeeper can cut them in order of size.
      .sort((a, b) => b.totalAmount - a.totalAmount)

    const partnerPayouts: PartnerPayoutData = {
      rows: partnerPayoutRows,
      totalPayroll: payroll.totalAmount,
      totalOrigination: origination.totalAmount,
      totalCloser: closer.totalAmount,
      totalAmount:
        payroll.totalAmount + origination.totalAmount + closer.totalAmount,
    }

    // ------------------------------------------------------------------
    // Prepaid billing
    // ------------------------------------------------------------------
    const prepaidData: PrepaidBillingRow[] = prepaidRows.map(row => {
      const totalHours = toFiniteNumber(row.totalHours)
      return {
        clientId: row.clientId,
        clientName: row.clientName,
        totalHours,
        amount: totalHours * rates.billablePerHour,
      }
    })

    const prepaidTotalHours = prepaidData.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const prepaidBilling: PrepaidBillingData = {
      rows: prepaidData,
      totalHours: prepaidTotalHours,
      totalAmount: prepaidTotalHours * rates.billablePerHour,
      hourlyRate: rates.billablePerHour,
    }

    // ------------------------------------------------------------------
    // Net 30 billing
    // ------------------------------------------------------------------
    const net30Data: Net30Row[] = net30Rows.map(row => {
      const totalHours = toFiniteNumber(row.totalHours)
      return {
        clientId: row.clientId,
        clientName: row.clientName,
        totalHours,
        amount: totalHours * rates.billablePerHour,
      }
    })

    const net30TotalHours = net30Data.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const net30Billing: Net30Data = {
      rows: net30Data,
      totalHours: net30TotalHours,
      totalAmount: net30TotalHours * rates.billablePerHour,
      hourlyRate: rates.billablePerHour,
    }

    // ------------------------------------------------------------------
    // Totals + House (rate-based, billing basis)
    //
    // The reporting model:
    //
    //   Payroll      → WORK basis (admin hours × payroll rate)
    //   Origination  → BILLING basis (billing hours × origination rate)
    //   Closer       → BILLING basis (billing hours × closer rate)
    //   House        → BILLING basis (billing hours × house rate)
    //
    // House is computed DIRECTLY from the rate schedule — March 2026 will
    // show 40% ($80/hr), April 2026+ will show 25% ($50/hr). Because
    // Payroll lives on a different population, the four buckets don't
    // cleanly reconcile to Billing In in a single month — that's a real
    // cash-vs-accrual gap and is expected.
    //
    // work_billable_total is exposed as a separate metric (Work Billable
    // card) for payroll context.
    // ------------------------------------------------------------------
    const workBillableTotal = billableWorkHours * rates.billablePerHour

    const combinedBillingTotal =
      prepaidBilling.totalAmount + net30Billing.totalAmount
    // House is a rate × billing-hours calculation. Billing hours = prepaid
    // hours purchased + net_30 hours logged (same population as
    // origination/closer). Billing on a client whose as-of commission term
    // has no closer keeps its closer share in house (PRD 007) — nobody is
    // paid it, so it is reported here rather than vanishing from the split.
    // House is an ESTIMATE either way: it is the firm's nominal share, not a
    // cash residual.
    const billingHours =
      prepaidBilling.totalHours + net30Billing.totalHours
    const nominalHouseAmount = billingHours * rates.housePerHour
    const unassignedCloserHours = Math.max(
      0,
      round2(billingHours - closer.totalHours)
    )
    const unassignedCloserAmount = unassignedCloserHours * rates.closerPerHour
    const house: HouseData = {
      billableHours: billingHours,
      ratePerHour: rates.housePerHour,
      nominalAmount: nominalHouseAmount,
      unassignedCloserHours,
      unassignedCloserAmount,
      totalAmount: nominalHouseAmount + unassignedCloserAmount,
    }

    const combinedPayoutTotal =
      payroll.totalAmount +
      origination.totalAmount +
      closer.totalAmount +
      house.totalAmount

    return {
      payroll,
      origination,
      closer,
      partnerPayouts,
      prepaidBilling,
      net30Billing,
      house,
      workBillableHours: billableWorkHours,
      workBillableTotal,
      combinedBillingTotal,
      combinedPayoutTotal,
      rates,
      minCursor: bounds.min,
      maxCursor: bounds.max,
    }
  }
)
