import {
  Briefcase,
  Building,
  Building2,
  CreditCard,
  Handshake,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

import type { PartnerRateSchedule } from '@/lib/billing/partner-rates'

import { formatCurrency } from './section-shell'

function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

type Icon = ComponentType<{ className?: string }>

// ------------------------------------------------------------------
// RollupCard — composite hero used for Billing In + Total Payouts.
// The hero number dominates; breakdown rows sit beneath a thin rule,
// each row: icon + label (left) + value (right), tabular-nums.
// ------------------------------------------------------------------
type RollupChild = {
  label: string
  sublabel?: string
  value: number
  icon: Icon
}

type RollupCardProps = {
  label: string
  icon: Icon
  total: number
  caption: string
  rows: RollupChild[]
  accent: 'emerald' | 'violet'
  action?: ReactNode
  /** When true, the card stretches to fill its parent and pins the action to the bottom. */
  stretch?: boolean
}

function RollupCard({
  label,
  icon: Icon,
  total,
  caption,
  rows,
  accent,
  action,
  stretch,
}: RollupCardProps) {
  const glow = {
    emerald:
      'before:bg-[radial-gradient(60%_80%_at_100%_0%,theme(colors.emerald.500/0.18),transparent)]',
    violet:
      'before:bg-[radial-gradient(60%_80%_at_100%_0%,theme(colors.violet.500/0.18),transparent)]',
  }
  const iconTone = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    violet: 'text-violet-600 dark:text-violet-400',
  }

  return (
    <section
      className={cn(
        'bg-card relative overflow-hidden rounded-xl border shadow-sm',
        'before:pointer-events-none before:absolute before:inset-0',
        stretch && 'flex h-full flex-col',
        glow[accent]
      )}
    >
      <div
        className={cn(
          'relative px-5 pt-5 pb-5',
          stretch && 'flex flex-1 flex-col'
        )}
      >
        {/* Kicker */}
        <div className='flex items-center gap-2'>
          <Icon className={cn('h-4 w-4', iconTone[accent])} />
          <h3 className='text-sm leading-none font-semibold tracking-[0.12em] uppercase'>
            {label}
          </h3>
        </div>

        {/* Hero number */}
        <div className='mt-3 text-4xl leading-none font-semibold tracking-tight tabular-nums'>
          {formatCurrency(total)}
        </div>

        {/* Caption */}
        <p className='text-foreground/60 mt-2 text-xs leading-snug'>
          {caption}
        </p>

        {/* Breakdown rows — thin rule + stacked label/value pairs */}
        {rows.length > 0 ? (
          <div className='border-border/60 mt-5 space-y-2.5 border-t pt-4'>
            {rows.map(child => (
              <div
                key={child.label}
                className='flex items-center justify-between gap-4'
              >
                <div className='text-foreground/70 flex min-w-0 items-center gap-2 text-xs'>
                  <child.icon className='text-muted-foreground/70 h-3 w-3 shrink-0' />
                  <span className='truncate'>{child.label}</span>
                  {child.sublabel ? (
                    <span className='text-muted-foreground/60 shrink-0'>
                      · {child.sublabel}
                    </span>
                  ) : null}
                </div>
                <div className='shrink-0 text-sm font-semibold tabular-nums'>
                  {formatCurrency(child.value)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {action ? (
          <div
            className={cn(
              'flex justify-end pt-4',
              stretch ? 'mt-auto' : 'mt-0'
            )}
          >
            {action}
          </div>
        ) : null}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------

type BillingInCardProps = {
  total: number
  prepaidTotal: number
  prepaidHours: number
  net30Total: number
  net30Hours: number
  action?: ReactNode
}

export function BillingInCard({
  total,
  prepaidTotal,
  prepaidHours,
  net30Total,
  net30Hours,
  action,
}: BillingInCardProps) {
  return (
    <RollupCard
      label='Billing In'
      icon={TrendingUp}
      total={total}
      caption='Cash collected this month — prepaid invoices plus net 30 hours logged.'
      accent='emerald'
      action={action}
      rows={[
        {
          label: 'Prepaid',
          sublabel: `${prepaidHours.toFixed(2)} hrs`,
          value: prepaidTotal,
          icon: CreditCard,
        },
        {
          label: 'Net 30',
          sublabel: `${net30Hours.toFixed(2)} hrs`,
          value: net30Total,
          icon: Building2,
        },
      ]}
    />
  )
}

type TotalPayoutsCardProps = {
  rates: PartnerRateSchedule
  total: number
  payrollTotal: number
  originationTotal: number
  closerTotal: number
  houseTotal: number
  action?: ReactNode
}

export function TotalPayoutsCard({
  rates,
  total,
  payrollTotal,
  originationTotal,
  closerTotal,
  houseTotal,
  action,
}: TotalPayoutsCardProps) {
  const children: RollupChild[] = []

  // Hide any bucket whose rate is 0 (e.g., closer pre-cutover).
  if (rates.payrollPerHour > 0) {
    children.push({
      label: 'Payroll',
      sublabel: formatPercent(rates.payrollPerHour, rates.billablePerHour),
      value: payrollTotal,
      icon: Users,
    })
  }
  if (rates.originationPerHour > 0) {
    children.push({
      label: 'Origination',
      sublabel: formatPercent(rates.originationPerHour, rates.billablePerHour),
      value: originationTotal,
      icon: Handshake,
    })
  }
  if (rates.closerPerHour > 0) {
    children.push({
      label: 'Closer',
      sublabel: formatPercent(rates.closerPerHour, rates.billablePerHour),
      value: closerTotal,
      icon: UserCheck,
    })
  }
  // House is an estimate (the firm's nominal share plus any unassigned closer
  // share), never a payout — label it so nobody cuts a check for it.
  children.push({
    label: 'House (est.)',
    sublabel: `${formatPercent(rates.housePerHour, rates.billablePerHour)} · estimated`,
    value: houseTotal,
    icon: Building,
  })

  return (
    <RollupCard
      label='Billing Distribution'
      icon={Wallet}
      total={total}
      caption='How billing is distributed — Payroll + Origination + Closer + House (est.).'
      accent='violet'
      action={action}
      stretch
      rows={children}
    />
  )
}

type HoursLoggedCardProps = {
  hours: number
}

export function HoursLoggedCard({ hours }: HoursLoggedCardProps) {
  return (
    <section className='bg-card overflow-hidden rounded-xl border shadow-sm'>
      <header className='flex items-start justify-between gap-6 px-5 pt-5 pb-5'>
        <div className='flex min-w-0 items-start gap-3'>
          <Briefcase className='text-muted-foreground h-5 w-5 shrink-0' />
          <div className='min-w-0 space-y-1.5'>
            <h3 className='text-xl leading-none font-semibold tracking-tight'>
              Total Hours Logged
            </h3>
            <p className='text-foreground/60 text-xs leading-snug'>
              Hours logged on client projects this month.
            </p>
          </div>
        </div>
        <div className='shrink-0 text-2xl leading-none font-semibold tracking-tight tabular-nums'>
          {hours.toFixed(2)}
        </div>
      </header>
    </section>
  )
}
