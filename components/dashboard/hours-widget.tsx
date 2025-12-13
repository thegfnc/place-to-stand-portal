'use client'

import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { cn } from '@/lib/utils'
import type { HoursSnapshot } from '@/lib/dashboard/types'

const API_ENDPOINT = '/api/dashboard/hours'

type HoursWidgetProps = {
  initialSnapshot: HoursSnapshot
  className?: string
}

export function HoursWidget({ initialSnapshot, className }: HoursWidgetProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDirection, setPendingDirection] = useState<
    'prev' | 'next' | null
  >(null)

  const monthLabel = useMemo(
    () => formatMonthLabel(snapshot.year, snapshot.month),
    [snapshot.month, snapshot.year]
  )

  const minLimitLabel = useMemo(
    () => formatMonthLabel(snapshot.minCursor.year, snapshot.minCursor.month),
    [snapshot.minCursor.month, snapshot.minCursor.year]
  )

  const maxLimitLabel = useMemo(
    () => formatMonthLabel(snapshot.maxCursor.year, snapshot.maxCursor.month),
    [snapshot.maxCursor.month, snapshot.maxCursor.year]
  )

  const canGoPrev = useMemo(
    () => compareMonthCursor(snapshot, snapshot.minCursor) > 0,
    [
      snapshot.month,
      snapshot.year,
      snapshot.minCursor.month,
      snapshot.minCursor.year,
    ]
  )

  const canGoNext = useMemo(
    () => compareMonthCursor(snapshot, snapshot.maxCursor) < 0,
    [
      snapshot.month,
      snapshot.year,
      snapshot.maxCursor.month,
      snapshot.maxCursor.year,
    ]
  )

  const prevDisabled = isLoading || !canGoPrev
  const nextDisabled = isLoading || !canGoNext

  const prevTooltipReason = !canGoPrev
    ? `No time logs before ${minLimitLabel}.`
    : isLoading
      ? pendingDirection === 'prev'
        ? 'Loading previous month...'
        : 'Please wait while we update the month.'
      : null

  const nextTooltipReason = !canGoNext
    ? `No data beyond ${maxLimitLabel} yet.`
    : isLoading
      ? pendingDirection === 'next'
        ? 'Loading next month...'
        : 'Please wait while we update the month.'
      : null

  const handleShift = useCallback(
    async (delta: number) => {
      const direction: 'prev' | 'next' = delta < 0 ? 'prev' : 'next'

      if (isLoading) {
        return
      }
      if (direction === 'prev' && !canGoPrev) {
        return
      }
      if (direction === 'next' && !canGoNext) {
        return
      }

      setIsLoading(true)
      setPendingDirection(direction)
      setError(null)
      const target = shiftMonth(snapshot, delta)

      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(target),
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Request failed')
        }

        const payload = (await response.json()) as HoursSnapshot
        setSnapshot(payload)
      } catch (requestError) {
        console.error('Failed to load hours snapshot', requestError)
        setError('Unable to load that month. Please try again.')
      } finally {
        setIsLoading(false)
        setPendingDirection(null)
      }
    },
    [canGoNext, canGoPrev, isLoading, snapshot]
  )

  return (
    <section
      className={cn(
        'bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='hours-widget-heading'
    >
      <header className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4'>
        <div>
          <h2 id='hours-widget-heading' className='text-base font-semibold'>
            Monthly Hours Snapshot
          </h2>
          <p className='text-muted-foreground text-xs'>
            Hours logged for you and the company.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <p className='mr-2 text-sm font-medium whitespace-nowrap'>
            {monthLabel}
          </p>
          <DisabledFieldTooltip
            disabled={prevDisabled}
            reason={prevTooltipReason}
          >
            <Button
              type='button'
              variant='outline'
              size='icon-sm'
              onClick={() => handleShift(-1)}
              disabled={prevDisabled}
              aria-label='View previous month'
            >
              {isLoading && pendingDirection === 'prev' ? (
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
              ) : (
                <ChevronLeft className='h-4 w-4' aria-hidden />
              )}
            </Button>
          </DisabledFieldTooltip>
          <DisabledFieldTooltip
            disabled={nextDisabled}
            reason={nextTooltipReason}
          >
            <Button
              type='button'
              variant='outline'
              size='icon-sm'
              onClick={() => handleShift(1)}
              disabled={nextDisabled}
              aria-label='View next month'
            >
              {isLoading && pendingDirection === 'next' ? (
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
              ) : (
                <ChevronRight className='h-4 w-4' aria-hidden />
              )}
            </Button>
          </DisabledFieldTooltip>
        </div>
      </header>
      <div className='flex flex-1 flex-col gap-4 px-5 py-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <StatCard
            label='My hours logged'
            value={formatHours(snapshot.myHours)}
          />
          <StatCard
            label='Total hours logged'
            value={formatHours(snapshot.companyHours)}
          />
        </div>
        {error ? <p className='text-destructive text-xs'>{error}</p> : null}
      </div>
    </section>
  )
}

type StatCardProps = {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className='rounded-lg border px-4 py-3'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        {label}
      </p>
      <p className='text-foreground mt-1 text-2xl font-semibold'>{value}</p>
    </div>
  )
}

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
]

function formatMonthLabel(year: number, month: number) {
  const label = MONTH_NAMES[month - 1] ?? 'Unknown'
  return `${label} ${year}`
}

type CursorLike = {
  year: number
  month: number
}

function shiftMonth(cursor: CursorLike, delta: number) {
  const date = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

function formatHours(value: number) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}h`
}

function compareMonthCursor(a: CursorLike, b: CursorLike) {
  const aValue = a.year * 12 + (a.month - 1)
  const bValue = b.year * 12 + (b.month - 1)

  if (aValue < bValue) {
    return -1
  }
  if (aValue > bValue) {
    return 1
  }
  return 0
}
