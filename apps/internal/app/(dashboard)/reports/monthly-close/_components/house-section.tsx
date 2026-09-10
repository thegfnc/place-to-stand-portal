import { Building } from 'lucide-react'

import type { HouseData } from '@/lib/data/reports/types'

import {
  SectionShell,
  SectionRow,
  SectionRowList,
  formatCurrency,
} from './section-shell'

type HouseSectionProps = {
  data: HouseData
  nominalPercent: string
  /** This period's closer rate — prices the unassigned-closer row. */
  closerPerHour: number
  prepaidHours: number
  net30Hours: number
}

/**
 * House is an ESTIMATE, never a payout. It is the firm's nominal share of
 * billing plus the closer share of any billing whose client had no closer
 * for the period (PRD 007). Payroll runs on a work basis, so this does not
 * reconcile to cash left over — the "estimated" label is deliberate and
 * should stay wherever house is shown.
 */
export function HouseSection({
  data,
  nominalPercent,
  closerPerHour,
  prepaidHours,
  net30Hours,
}: HouseSectionProps) {
  return (
    <SectionShell
      compact
      icon={Building}
      iconTone='emerald'
      title='House (est.)'
      description={`Estimated — ${nominalPercent} house rate at $${data.ratePerHour}/hr on billing in, plus the closer share of any billing with no closer assigned. Not a payout.`}
      total={formatCurrency(data.totalAmount)}
      totalLabel='estimated'
    >
      <SectionRowList>
        <SectionRow
          primary='Prepaid'
          hours={prepaidHours}
          amount={prepaidHours * data.ratePerHour}
        />
        <SectionRow
          primary='Net 30'
          hours={net30Hours}
          amount={net30Hours * data.ratePerHour}
        />
        {data.unassignedCloserHours > 0 ? (
          <SectionRow
            primary='No closer assigned'
            secondary={`Closer share kept in house at $${closerPerHour}/hr`}
            hours={data.unassignedCloserHours}
            amount={data.unassignedCloserAmount}
          />
        ) : null}
      </SectionRowList>
    </SectionShell>
  )
}
