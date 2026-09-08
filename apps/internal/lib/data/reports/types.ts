// Types for Monthly Close Report

import type { PartnerRateSchedule } from '@/lib/billing/partner-rates'

export type MonthCursor = {
  year: number
  month: number // 1-indexed (1 = January, 12 = December)
}

type OriginatorKind = 'user' | 'contact'

// Payroll
export type PayrollRow = {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  updatedAt: string
  totalHours: number
  amount: number
}

export type PayrollData = {
  rows: PayrollRow[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

// Origination — the "finder" bucket. Each row is one client under one
// originator; the data layer groups them by `${kind}:${id}` to roll totals
// per originator across both billing types.
export type OriginationClientDetail = {
  clientId: string
  clientName: string
  billingType: 'prepaid' | 'net_30'
  hours: number
  commission: number
}

export type OriginationGroupRow = {
  originatorKind: OriginatorKind
  originatorId: string
  originatorName: string
  originatorEmail: string
  /** Only populated for `originatorKind === 'user'`. */
  originatorAvatarUrl: string | null
  originatorUpdatedAt: string | null
  clients: OriginationClientDetail[]
  totalHours: number
  totalCommission: number
}

export type OriginationData = {
  rows: OriginationGroupRow[]
  totalHours: number
  totalAmount: number
  commissionPerHour: number
}

// Closer — internal PTS partner who finalized the deal.
export type CloserClientDetail = {
  clientId: string
  clientName: string
  billingType: 'prepaid' | 'net_30'
  hours: number
  commission: number
}

export type CloserGroupRow = {
  closerUserId: string
  closerName: string | null
  closerEmail: string
  closerAvatarUrl: string | null
  closerUpdatedAt: string
  clients: CloserClientDetail[]
  totalHours: number
  totalCommission: number
}

export type CloserData = {
  rows: CloserGroupRow[]
  totalHours: number
  totalAmount: number
  commissionPerHour: number
}

// Prepaid billing
export type PrepaidBillingRow = {
  clientId: string
  clientName: string
  totalHours: number
  amount: number
}

export type PrepaidBillingData = {
  rows: PrepaidBillingRow[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

// Net 30 billing
export type Net30Row = {
  clientId: string
  clientName: string
  totalHours: number
  amount: number
}

export type Net30Data = {
  rows: Net30Row[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

// Partner Payouts — lump-sum view. Groups Payroll + Origination + Closer
// by payee so the bookkeeper has one row per check to cut.
type PartnerPayoutPayeeKind = 'user' | 'contact'

export type PartnerPayoutRow = {
  /** `${kind}:${id}` — unique across users and contacts. */
  key: string
  kind: PartnerPayoutPayeeKind
  id: string
  name: string
  email: string
  /** Only populated for `kind === 'user'`. */
  avatarUrl: string | null
  avatarUpdatedAt: string | null
  payrollAmount: number
  originationAmount: number
  closerAmount: number
  totalAmount: number
}

export type PartnerPayoutData = {
  rows: PartnerPayoutRow[]
  totalPayroll: number
  totalOrigination: number
  totalCloser: number
  totalAmount: number
}

// House — the firm's share of billing. Rate-based, computed directly as:
//   billingHours × rates.housePerHour
// where `billingHours = prepaidBilling.totalHours + net30Billing.totalHours`.
// This is the same population as origination/closer, so the firm always
// gets its nominal percentage of every billed hour (40% pre-cutover, 25%
// post-cutover), regardless of client assignment gaps.
export type HouseData = {
  /** Total billing hours in the period (prepaid purchased + net_30 logged). */
  billableHours: number
  /** Nominal house rate for this period (e.g. $50/hr or $80/hr). */
  ratePerHour: number
  /** billingHours × ratePerHour — the firm's share of billing this month. */
  totalAmount: number
}

export type MonthlyCloseReport = {
  payroll: PayrollData
  origination: OriginationData
  closer: CloserData
  partnerPayouts: PartnerPayoutData
  prepaidBilling: PrepaidBillingData
  net30Billing: Net30Data
  house: HouseData
  /** Admin hours logged on CLIENT projects in the period. */
  workBillableHours: number
  /** `workBillableHours × billablePerHour` — the accrual basis for payouts. */
  workBillableTotal: number
  /** Combined billing in (prepaid purchased + net_30 logged) — cash-flow view. */
  combinedBillingTotal: number
  /** Combined payouts (payroll + origination + closer). */
  combinedPayoutTotal: number
  /** The partner rate schedule that was in effect for this reporting period. */
  rates: PartnerRateSchedule
  minCursor: MonthCursor
  maxCursor: MonthCursor
}
