'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { format, parseISO } from 'date-fns'

import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import type { PartnerRateSchedule } from '@/lib/billing/partner-rates'

type FormulaNoticeProps = {
  rates: PartnerRateSchedule
  latestRates: PartnerRateSchedule
}

function formatEffectiveDate(iso: string): string {
  return format(parseISO(iso), 'MMMM d, yyyy')
}

function pct(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100)}%`
}

function RateBreakdown({ rates }: { rates: PartnerRateSchedule }) {
  return (
    <div className='grid gap-x-8 gap-y-1 sm:grid-cols-2'>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>Payroll</span>
        <span className='font-medium tabular-nums'>
          ${rates.payrollPerHour}/hr ({pct(rates.payrollPerHour, rates.billablePerHour)})
        </span>
      </div>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>Closer</span>
        <span className='font-medium tabular-nums'>
          {rates.closerPerHour > 0
            ? `$${rates.closerPerHour}/hr (${pct(rates.closerPerHour, rates.billablePerHour)})`
            : 'Not active'}
        </span>
      </div>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>Origination</span>
        <span className='font-medium tabular-nums'>
          ${rates.originationPerHour}/hr ({pct(rates.originationPerHour, rates.billablePerHour)})
        </span>
      </div>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>House (est.)</span>
        <span className='font-medium tabular-nums'>
          ${rates.housePerHour}/hr ({pct(rates.housePerHour, rates.billablePerHour)})
        </span>
      </div>
      {!rates.internalOriginationPayable ? (
        <div className='text-foreground/50 col-span-full mt-1 text-xs'>
          Internal originators not paid this period (absorbed into house).
        </div>
      ) : null}
    </div>
  )
}

export function FormulaNotice({ rates, latestRates }: FormulaNoticeProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className='rounded-xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20'>
        <CollapsibleTrigger className='flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left'>
          <Info className='h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-medium text-amber-900 dark:text-amber-200'>
              This month uses an older payout formula
            </p>
            <p className='text-xs text-amber-800/70 dark:text-amber-300/60'>
              Effective since {formatEffectiveDate(rates.effectiveFrom)}.
              The current formula took effect{' '}
              {formatEffectiveDate(latestRates.effectiveFrom)}.
            </p>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-amber-600 transition-transform duration-200 dark:text-amber-400',
              open && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className='border-t border-amber-500/20 px-4 pt-4 pb-4'>
            {/* This month's formula */}
            <div>
              <h4 className='mb-2 text-xs font-semibold tracking-[0.1em] uppercase text-amber-900/80 dark:text-amber-200/80'>
                This month&apos;s formula (${rates.billablePerHour}/hr split)
              </h4>
              <RateBreakdown rates={rates} />
            </div>

            {/* Current formula for comparison */}
            <div className='mt-4 border-t border-amber-500/15 pt-4'>
              <h4 className='mb-2 text-xs font-semibold tracking-[0.1em] uppercase text-amber-900/80 dark:text-amber-200/80'>
                Current formula (since {formatEffectiveDate(latestRates.effectiveFrom)})
              </h4>
              <RateBreakdown rates={latestRates} />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
