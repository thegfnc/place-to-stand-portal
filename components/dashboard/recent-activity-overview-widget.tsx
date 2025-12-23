'use client'

import { useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { SummaryContent } from '@/components/dashboard/recent-activity-overview/summary-content'
import {
  TIMEFRAME_OPTIONS,
  type TimeframeValue,
} from '@/components/dashboard/recent-activity-overview/constants'
import { useRecentActivitySummary } from '@/components/dashboard/recent-activity-overview/use-recent-activity-summary'
import { WidgetControls } from '@/components/dashboard/recent-activity-overview/widget-controls'

type RecentActivityOverviewWidgetProps = {
  className?: string
}

export function RecentActivityOverviewWidget({
  className,
}: RecentActivityOverviewWidgetProps) {
  const {
    state,
    selectedTimeframe,
    statusLabel,
    metaLabel,
    isBusy,
    refresh,
    changeTimeframe,
  } = useRecentActivitySummary()

  const handleTimeframeChange = useCallback(
    (value: string) => {
      changeTimeframe(value as TimeframeValue)
    },
    [changeTimeframe]
  )

  return (
    <section
      className={cn(
        'bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='recent-activity-overview-heading'
    >
      <Tabs
        value={selectedTimeframe}
        onValueChange={handleTimeframeChange}
        className='flex h-full flex-col'
      >
        <WidgetControls
          options={TIMEFRAME_OPTIONS}
          onRefresh={refresh}
          isRefreshing={isBusy}
        />
        <div className='flex flex-1 flex-col overflow-hidden'>
          <div className='flex-1 overflow-y-auto px-5 py-4'>
            <SummaryContent state={state} />
          </div>
          <footer className='text-muted-foreground border-t px-5 py-3 text-xs'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                variant='outline'
                className='text-[10px] font-semibold tracking-wide uppercase'
              >
                {statusLabel}
              </Badge>
              {metaLabel ? <span>{metaLabel}</span> : null}
            </div>
          </footer>
        </div>
      </Tabs>
    </section>
  )
}
