import type { MonthlyCloseReport } from './types'

/**
 * The persisted report: MonthlyCloseReport minus the global navigation
 * cursors, which are always computed live.
 */
export type SnapshotReport = Omit<MonthlyCloseReport, 'minCursor' | 'maxCursor'>

export type CloseDriftDelta = {
  section:
    | 'prepaidBilling'
    | 'net30Billing'
    | 'payroll'
    | 'origination'
    | 'closer'
    | 'partnerPayouts'
    | 'house'
    | 'summary'
    | 'rates'
  /** Section name, or "Section · payee/client" for row-level differences. */
  label: string
  unit: 'hours' | 'amount' | 'rate' | 'flag'
  snapshotValue: number
  liveValue: number
}

/** Hours are NUMERIC(8,2) — compare rounded to avoid float noise. */
const round2 = (value: number): number => Math.round(value * 100) / 100

const differs = (a: number, b: number): boolean => round2(a) !== round2(b)

type FieldSpec<T> = {
  unit: CloseDriftDelta['unit']
  /** Qualifier appended to the row label, e.g. "origination". */
  note?: string
  value: (row: T) => number
}

/**
 * Outer-joined row comparison. A row present on only one side compares against
 * zero, so a payee or client appearing or vanishing is drift, not a silent skip.
 */
function diffRows<T>(
  deltas: CloseDriftDelta[],
  opts: {
    section: CloseDriftDelta['section']
    prefix: string
    snapRows: readonly T[]
    liveRows: readonly T[]
    key: (row: T) => string
    name: (row: T) => string
    fields: ReadonlyArray<FieldSpec<T>>
  }
): void {
  const snapByKey = new Map(opts.snapRows.map(r => [opts.key(r), r]))
  const liveByKey = new Map(opts.liveRows.map(r => [opts.key(r), r]))

  for (const key of new Set([...snapByKey.keys(), ...liveByKey.keys()])) {
    const snap = snapByKey.get(key)
    const liveRow = liveByKey.get(key)
    const name = snap ? opts.name(snap) : liveRow ? opts.name(liveRow) : key

    for (const field of opts.fields) {
      const snapValue = snap ? field.value(snap) : 0
      const liveValue = liveRow ? field.value(liveRow) : 0
      if (differs(snapValue, liveValue)) {
        deltas.push({
          section: opts.section,
          label: `${opts.prefix} · ${name}${field.note ? ` (${field.note})` : ''}`,
          unit: field.unit,
          snapshotValue: snapValue,
          liveValue,
        })
      }
    }
  }
}

/**
 * Canonical snapshot-vs-live comparison (F2). The snapshot freezes every value
 * the page renders, so this compares every one of them — anything omitted here
 * is a number that can change under a closed month without the banner firing.
 *
 * Section totals alone are not enough: hours moved between users, a closer
 * swap, or offsetting edits change WHO gets paid while the totals hold still.
 * So this also walks per-person rows, the per-client detail inside each
 * commission group, and each payee's payroll/origination/closer split — not
 * just their combined total, which an offsetting reassignment leaves intact.
 *
 * Not compared: `rates.effectiveFrom` (a string). Re-dating the schedule
 * without changing any figure has no financial effect, and every rate that
 * carries money is compared numerically below.
 */
export function computeDeltas(
  snapshot: SnapshotReport,
  live: MonthlyCloseReport
): CloseDriftDelta[] {
  // Leaf-level differences (a specific payee, a specific client) are what a
  // bookkeeper acts on; aggregates are usually the same change restated. One
  // rate edit can move a dozen totals at once, so aggregates are collected
  // separately and appended last — otherwise they crowd the actionable rows
  // out of any capped display.
  const rowDeltas: CloseDriftDelta[] = []
  const totalDeltas: CloseDriftDelta[] = []

  const push = (
    section: CloseDriftDelta['section'],
    label: string,
    unit: CloseDriftDelta['unit'],
    snapValue: number,
    liveValue: number
  ): void => {
    if (differs(snapValue, liveValue)) {
      totalDeltas.push({
        section,
        label,
        unit,
        snapshotValue: snapValue,
        liveValue,
      })
    }
  }

  // ---- Section totals: hours, dollars, and the rate each section applied ----
  const sections: ReadonlyArray<{
    section: CloseDriftDelta['section']
    label: string
    snap: { totalHours: number; totalAmount: number; rate: number }
    liveSection: { totalHours: number; totalAmount: number; rate: number }
  }> = [
    {
      section: 'prepaidBilling',
      label: 'Prepaid billing',
      snap: { ...snapshot.prepaidBilling, rate: snapshot.prepaidBilling.hourlyRate },
      liveSection: { ...live.prepaidBilling, rate: live.prepaidBilling.hourlyRate },
    },
    {
      section: 'net30Billing',
      label: 'Net 30 billing',
      snap: { ...snapshot.net30Billing, rate: snapshot.net30Billing.hourlyRate },
      liveSection: { ...live.net30Billing, rate: live.net30Billing.hourlyRate },
    },
    {
      section: 'payroll',
      label: 'Payroll',
      snap: { ...snapshot.payroll, rate: snapshot.payroll.hourlyRate },
      liveSection: { ...live.payroll, rate: live.payroll.hourlyRate },
    },
    {
      section: 'origination',
      label: 'Origination',
      snap: { ...snapshot.origination, rate: snapshot.origination.commissionPerHour },
      liveSection: { ...live.origination, rate: live.origination.commissionPerHour },
    },
    {
      section: 'closer',
      label: 'Closer',
      snap: { ...snapshot.closer, rate: snapshot.closer.commissionPerHour },
      liveSection: { ...live.closer, rate: live.closer.commissionPerHour },
    },
  ]

  for (const { section, label, snap, liveSection } of sections) {
    push(section, label, 'hours', snap.totalHours, liveSection.totalHours)
    push(section, label, 'amount', snap.totalAmount, liveSection.totalAmount)
    push(section, `${label} rate`, 'rate', snap.rate, liveSection.rate)
  }

  // ---- House and the summary figures ----
  push('house', 'House hours', 'hours', snapshot.house.billableHours, live.house.billableHours)
  push('house', 'House (est.)', 'amount', snapshot.house.totalAmount, live.house.totalAmount)
  push('house', 'House rate', 'rate', snapshot.house.ratePerHour, live.house.ratePerHour)
  push('house', 'House · unassigned closer hours', 'hours', snapshot.house.unassignedCloserHours, live.house.unassignedCloserHours)
  push('house', 'House · unassigned closer', 'amount', snapshot.house.unassignedCloserAmount, live.house.unassignedCloserAmount)

  push('summary', 'Work billable hours', 'hours', snapshot.workBillableHours, live.workBillableHours)
  push('summary', 'Work billable total', 'amount', snapshot.workBillableTotal, live.workBillableTotal)
  push('summary', 'Combined billing in', 'amount', snapshot.combinedBillingTotal, live.combinedBillingTotal)
  push('summary', 'Combined payouts', 'amount', snapshot.combinedPayoutTotal, live.combinedPayoutTotal)

  // ---- Rate schedule: an edit here silently re-prices every payout ----
  push('rates', 'Billable rate', 'rate', snapshot.rates.billablePerHour, live.rates.billablePerHour)
  push('rates', 'Payroll rate', 'rate', snapshot.rates.payrollPerHour, live.rates.payrollPerHour)
  push('rates', 'Closer rate', 'rate', snapshot.rates.closerPerHour, live.rates.closerPerHour)
  push('rates', 'Origination rate', 'rate', snapshot.rates.originationPerHour, live.rates.originationPerHour)
  push('rates', 'House rate', 'rate', snapshot.rates.housePerHour, live.rates.housePerHour)
  push(
    'rates',
    'Internal origination payable',
    'flag',
    snapshot.rates.internalOriginationPayable ? 1 : 0,
    live.rates.internalOriginationPayable ? 1 : 0
  )

  // ---- Per-client billing rows ----
  for (const [section, prefix, snapSection, liveSection] of [
    ['prepaidBilling', 'Prepaid', snapshot.prepaidBilling, live.prepaidBilling],
    ['net30Billing', 'Net 30', snapshot.net30Billing, live.net30Billing],
  ] as const) {
    diffRows(rowDeltas, {
      section,
      prefix,
      snapRows: snapSection.rows,
      liveRows: liveSection.rows,
      key: row => row.clientId,
      name: row => row.clientName,
      fields: [
        { unit: 'hours', value: row => row.totalHours },
        { unit: 'amount', value: row => row.amount },
      ],
    })
  }

  // ---- Per-person payroll ----
  diffRows(rowDeltas, {
    section: 'payroll',
    prefix: 'Payroll',
    snapRows: snapshot.payroll.rows,
    liveRows: live.payroll.rows,
    key: row => row.userId,
    name: row => row.fullName ?? row.email,
    fields: [
      { unit: 'hours', value: row => row.totalHours },
      { unit: 'amount', value: row => row.amount },
    ],
  })

  // ---- Per-originator, then the per-client detail inside each group ----
  diffRows(rowDeltas, {
    section: 'origination',
    prefix: 'Origination',
    snapRows: snapshot.origination.rows,
    liveRows: live.origination.rows,
    key: row => `${row.originatorKind}:${row.originatorId}`,
    name: row => row.originatorName,
    fields: [
      { unit: 'hours', value: row => row.totalHours },
      { unit: 'amount', value: row => row.totalCommission },
    ],
  })

  for (const originatorKey of new Set([
    ...snapshot.origination.rows.map(r => `${r.originatorKind}:${r.originatorId}`),
    ...live.origination.rows.map(r => `${r.originatorKind}:${r.originatorId}`),
  ])) {
    const keyOf = (r: { originatorKind: string; originatorId: string }) =>
      `${r.originatorKind}:${r.originatorId}`
    const snapGroup = snapshot.origination.rows.find(r => keyOf(r) === originatorKey)
    const liveGroup = live.origination.rows.find(r => keyOf(r) === originatorKey)
    const who = snapGroup?.originatorName ?? liveGroup?.originatorName ?? originatorKey

    diffRows(rowDeltas, {
      section: 'origination',
      prefix: `Origination · ${who}`,
      snapRows: snapGroup?.clients ?? [],
      liveRows: liveGroup?.clients ?? [],
      key: row => row.clientId,
      name: row => row.clientName,
      fields: [
        { unit: 'hours', value: row => row.hours },
        { unit: 'amount', value: row => row.commission },
      ],
    })
  }

  // ---- Per-closer, then the per-client detail inside each group ----
  diffRows(rowDeltas, {
    section: 'closer',
    prefix: 'Closer',
    snapRows: snapshot.closer.rows,
    liveRows: live.closer.rows,
    key: row => row.closerUserId,
    name: row => row.closerName ?? row.closerEmail,
    fields: [
      { unit: 'hours', value: row => row.totalHours },
      { unit: 'amount', value: row => row.totalCommission },
    ],
  })

  for (const closerId of new Set([
    ...snapshot.closer.rows.map(r => r.closerUserId),
    ...live.closer.rows.map(r => r.closerUserId),
  ])) {
    const snapGroup = snapshot.closer.rows.find(r => r.closerUserId === closerId)
    const liveGroup = live.closer.rows.find(r => r.closerUserId === closerId)
    const who =
      snapGroup?.closerName ??
      liveGroup?.closerName ??
      snapGroup?.closerEmail ??
      liveGroup?.closerEmail ??
      closerId

    diffRows(rowDeltas, {
      section: 'closer',
      prefix: `Closer · ${who}`,
      snapRows: snapGroup?.clients ?? [],
      liveRows: liveGroup?.clients ?? [],
      key: row => row.clientId,
      name: row => row.clientName,
      fields: [
        { unit: 'hours', value: row => row.hours },
        { unit: 'amount', value: row => row.commission },
      ],
    })
  }

  // ---- Per-payee payouts, split by component ----
  // The combined total is compared last and separately: an offsetting swap
  // (origination up, closer down by the same amount) leaves it untouched, so
  // the components are what actually catch a reassignment.
  diffRows(rowDeltas, {
    section: 'partnerPayouts',
    prefix: 'Payouts',
    snapRows: snapshot.partnerPayouts.rows,
    liveRows: live.partnerPayouts.rows,
    key: row => row.key,
    name: row => row.name,
    fields: [
      { unit: 'amount', note: 'payroll', value: row => row.payrollAmount },
      { unit: 'amount', note: 'origination', value: row => row.originationAmount },
      { unit: 'amount', note: 'closer', value: row => row.closerAmount },
      { unit: 'amount', value: row => row.totalAmount },
    ],
  })

  push('partnerPayouts', 'Payouts · payroll total', 'amount', snapshot.partnerPayouts.totalPayroll, live.partnerPayouts.totalPayroll)
  push('partnerPayouts', 'Payouts · origination total', 'amount', snapshot.partnerPayouts.totalOrigination, live.partnerPayouts.totalOrigination)
  push('partnerPayouts', 'Payouts · closer total', 'amount', snapshot.partnerPayouts.totalCloser, live.partnerPayouts.totalCloser)
  push('partnerPayouts', 'Payouts · grand total', 'amount', snapshot.partnerPayouts.totalAmount, live.partnerPayouts.totalAmount)

  return [...rowDeltas, ...totalDeltas]
}
