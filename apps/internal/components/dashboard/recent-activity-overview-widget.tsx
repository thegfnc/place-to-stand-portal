'use client'

import { useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Tabs } from '@pts/ui/tabs'
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
    modelLabel,
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
      {/*
        gap-0 overrides the Tabs root's default gap-2, which was adding 8px
        between the header rule and the body on top of the body's own py-3.
        Without it the metric cards sit lower than the Hours widget's stat
        cards, which have only their py-3 above them.
      */}
      <Tabs
        value={selectedTimeframe}
        onValueChange={handleTimeframeChange}
        className='flex h-full flex-col gap-0'
      >
        <WidgetControls
          options={TIMEFRAME_OPTIONS}
          onRefresh={refresh}
          isRefreshing={isBusy}
        />
        <div className='flex flex-1 flex-col overflow-hidden'>
          <div className='flex-1 overflow-y-auto px-4 py-3'>
            <SummaryContent state={state} />
          </div>
          <footer className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                variant='outline'
                className='text-[10px] font-semibold tracking-wide uppercase'
              >
                {statusLabel}
              </Badge>
              {metaLabel ? <span>{metaLabel}</span> : null}
            </div>
            {modelLabel ? (
              <span
                className='ml-auto font-mono text-[10px]'
                title='AI model used for the summary'
              >
                {modelLabel}
              </span>
            ) : null}
          </footer>
        </div>
      </Tabs>
    </section>
  )
}
