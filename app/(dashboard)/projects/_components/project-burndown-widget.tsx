'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { cn } from '@/lib/utils'
import { Eye, Plus } from 'lucide-react'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(value: number) {
  return HOURS_FORMATTER.format(value)
}

type ProjectBurndownWidgetProps = {
  totalClientRemainingHours: number
  totalProjectLoggedHours: number
  projectMonthToDateLoggedHours?: number
  className?: string
  canLogTime: boolean
  addTimeLogDisabledReason?: string | null
  viewTimeLogsHref: string | null
  onAddTimeLog: () => void
  showClientRemainingCard?: boolean
  showProjectMonthToDate?: boolean
}

export function ProjectBurndownWidget({
  totalClientRemainingHours,
  totalProjectLoggedHours,
  projectMonthToDateLoggedHours = 0,
  className,
  canLogTime,
  addTimeLogDisabledReason,
  viewTimeLogsHref,
  onAddTimeLog,
  showClientRemainingCard = true,
  showProjectMonthToDate = false,
}: ProjectBurndownWidgetProps) {
  const projectLogged = Math.max(totalProjectLoggedHours, 0)
  const projectMonthToDateLogged = Math.max(projectMonthToDateLoggedHours, 0)
  const shouldShowMonthToDate = showProjectMonthToDate
  const projectLoggedValue = shouldShowMonthToDate
    ? projectMonthToDateLogged
    : projectLogged
  const projectHoursLabel = shouldShowMonthToDate
    ? 'Project hours logged this month'
    : 'Project hours logged'
  const clientRemaining = totalClientRemainingHours
  const remainingTone = clientRemaining < 0 ? 'destructive' : 'default'

  return (
    <section
      className={cn('flex gap-2 text-[11px]', className)}
      aria-label='Burndown overview'
    >
      <dl className='flex flex-col gap-2 text-[10px] font-medium md:flex-row md:items-stretch md:gap-2'>
        <MetricRow
          label={projectHoursLabel}
          value={`${formatHours(projectLoggedValue)} hrs`}
        />
        {showClientRemainingCard ? (
          <MetricRow
            label='Client hours remaining'
            value={`${formatHours(clientRemaining)} hrs`}
            tone={remainingTone}
          />
        ) : null}
      </dl>
      <div className='flex flex-col gap-2'>
        {viewTimeLogsHref ? (
          <Button
            type='button'
            size='xs'
            variant='outline'
            asChild
            className='justify-start'
          >
            <Link href={viewTimeLogsHref} prefetch={false}>
              <Eye className='h-3! w-3!' />
              View
            </Link>
          </Button>
        ) : (
          <Button
            type='button'
            size='xs'
            variant='outline'
            disabled
            className='justify-start'
          >
            <Eye className='h-3! w-3!' />
            View
          </Button>
        )}
        <DisabledFieldTooltip
          disabled={!canLogTime}
          reason={
            !canLogTime
              ? (addTimeLogDisabledReason ??
                'Only internal teammates can add new time logs.')
              : null
          }
        >
          <Button
            type='button'
            size='xs'
            onClick={onAddTimeLog}
            disabled={!canLogTime}
            className='items-center justify-start'
          >
            <Plus className='h-3! w-3!' />
            Add
          </Button>
        </DisabledFieldTooltip>
      </div>
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
        'flex min-w-[200px] flex-1 items-center justify-between gap-1 rounded-md border px-3 py-2 md:flex-col md:items-start',
        tone === 'destructive'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-background text-foreground'
      )}
    >
      <span className='text-muted-foreground text-[10px] font-semibold tracking-wider text-nowrap uppercase'>
        {label}
      </span>
      <span className='text-foreground text-sm font-semibold'>{value}</span>
    </div>
  )
}
