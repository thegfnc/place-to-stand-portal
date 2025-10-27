'use client'

import { format } from 'date-fns'

import { cn } from '@/lib/utils'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(value: number) {
  return HOURS_FORMATTER.format(value)
}

function formatLastLogged(value: string | null): string {
  if (!value) {
    return 'No entries yet'
  }

  try {
    return format(new Date(value), 'MMM d, yyyy')
  } catch (error) {
    console.error('Failed to format time log date', error)
    return value
  }
}

type ProjectBurndownWidgetProps = {
  projectName: string
  clientName: string | null
  totalClientPurchasedHours: number
  totalClientLoggedHours: number
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  lastLogAt: string | null
  className?: string
}

export function ProjectBurndownWidget({
  projectName,
  clientName,
  totalClientPurchasedHours,
  totalClientLoggedHours,
  totalClientRemainingHours,
  totalProjectLoggedHours,
  lastLogAt,
  className,
}: ProjectBurndownWidgetProps) {
  const purchased = Math.max(totalClientPurchasedHours, 0)
  const clientLogged = Math.max(totalClientLoggedHours, 0)
  const projectLogged = Math.max(totalProjectLoggedHours, 0)
  const clientRemaining = Math.max(totalClientRemainingHours, 0)
  const overage = Math.max(clientLogged - purchased, 0)
  const title = clientName ?? projectName
  const secondaryTitle = clientName ? projectName : null

  return (
    <section
      className={cn(
        'border-border bg-card w-full max-w-xs rounded-lg border p-4 text-xs shadow-sm',
        className
      )}
      aria-label='Burndown overview'
    >
      <header className='space-y-1'>
        <p className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>
          Burndown overview
        </p>
        <p className='text-foreground text-sm leading-tight font-semibold'>
          {title}
        </p>
        {secondaryTitle ? (
          <p className='text-muted-foreground text-[11px]'>{secondaryTitle}</p>
        ) : null}
        <p className='text-muted-foreground text-[11px]'>
          Last log {formatLastLogged(lastLogAt)}
        </p>
      </header>
      <dl className='mt-3 space-y-2'>
        <MetricRow
          label='Client hours purchased'
          value={`${formatHours(purchased)} hrs`}
        />
        <MetricRow
          label='Client hours logged'
          value={`${formatHours(clientLogged)} hrs`}
        />
        <MetricRow
          label='Client hours remaining'
          value={`${formatHours(clientRemaining)} hrs`}
          tone={overage > 0 ? 'destructive' : 'default'}
        />
        <MetricRow
          label='Project hours logged'
          value={`${formatHours(projectLogged)} hrs`}
        />
        {overage > 0 ? (
          <MetricRow
            label='Client overage'
            value={`${formatHours(overage)} hrs`}
            tone='destructive'
          />
        ) : null}
      </dl>
    </section>
  )
}

type MetricRowProps = {
  label: string
  value: string
  tone?: 'default' | 'destructive'
}

function MetricRow({ label, value, tone = 'default' }: MetricRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-md border px-2 py-2',
        tone === 'destructive'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-background text-foreground'
      )}
    >
      <span className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>
        {label}
      </span>
      <span className='text-sm font-semibold'>{value}</span>
    </div>
  )
}
