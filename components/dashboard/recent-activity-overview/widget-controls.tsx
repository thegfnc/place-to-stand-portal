'use client'

import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { TIMEFRAME_OPTIONS, type TimeframeOption } from './constants'

type WidgetControlsProps = {
  options?: readonly TimeframeOption[]
  onRefresh: () => void
  isRefreshing: boolean
}

export function WidgetControls({
  options = TIMEFRAME_OPTIONS,
  onRefresh,
  isRefreshing,
}: WidgetControlsProps) {
  return (
    <header className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4'>
      <div>
        <h2
          id='recent-activity-overview-heading'
          className='text-base font-semibold'
        >
          Recent Activity Overview
        </h2>
        <p className='text-muted-foreground text-xs'>
          AI-generated summary of the activity logs so everyone stays aligned.
        </p>
      </div>
      <div className='flex items-center gap-2'>
        <TabsList className='h-9'>
          {options.map(option => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              title={option.description}
              className='px-2 py-1 text-xs'
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn('size-4', {
              'animate-spin': isRefreshing,
            })}
            aria-hidden
          />
          <span className='sr-only'>Refresh summary</span>
        </Button>
      </div>
    </header>
  )
}
