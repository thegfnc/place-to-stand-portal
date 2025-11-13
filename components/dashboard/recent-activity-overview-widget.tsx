'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { startClientInteraction } from '@/lib/posthog/client'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'
import type { InteractionHandle } from '@/lib/perf/interaction-marks'

const TIMEFRAME_OPTIONS = [
  { value: '7', label: '7d', description: 'Last 7 days' },
  { value: '14', label: '14d', description: 'Last 14 days' },
  { value: '28', label: '28d', description: 'Last 28 days' },
] as const

type TimeframeValue = (typeof TIMEFRAME_OPTIONS)[number]['value']

type SummaryStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error'

type SummaryState = {
  status: SummaryStatus
  text: string
  error: string | null
}

type CacheMeta = {
  cacheStatus: 'hit' | 'miss' | null
  cachedAt?: string | null
  expiresAt?: string | null
}

type RecentActivityOverviewWidgetProps = {
  className?: string
}

export function RecentActivityOverviewWidget({
  className,
}: RecentActivityOverviewWidgetProps) {
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<TimeframeValue>('7')
  const [refreshKey, setRefreshKey] = useState(0)
  const [state, setState] = useState<SummaryState>({
    status: 'idle',
    text: '',
    error: null,
  })
  const [cacheMeta, setCacheMeta] = useState<CacheMeta | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const lastRefreshKeyRef = useRef(refreshKey)
  const interactionRef = useRef<InteractionHandle | null>(null)
  const interactionContextRef = useRef<{
    trigger: 'initial' | 'refresh' | 'timeframe'
    timeframe: TimeframeValue
  } | null>(null)
  const pendingMetaRef = useRef<{ forceRefresh: boolean } | null>(null)

  const beginInteraction = useCallback(
    (trigger: 'initial' | 'refresh' | 'timeframe', timeframe: TimeframeValue) => {
      const base = {
        widget: 'recent_activity_overview',
        trigger,
        timeframe,
      }

      interactionRef.current?.end({
        status: 'replaced',
        ...base,
      })

      interactionRef.current = startClientInteraction(
        INTERACTION_EVENTS.DASHBOARD_REFRESH,
        {
          metadata: base,
          baseProperties: base,
        }
      )
      interactionContextRef.current = { trigger, timeframe }
    },
    []
  )

  const finishInteraction = useCallback(
    (
      status: 'success' | 'error' | 'cancelled',
      properties?: Record<string, unknown>
    ) => {
      if (!interactionRef.current) {
        return
      }

      const context = interactionContextRef.current
      interactionRef.current.end({
        status,
        ...(context ?? {}),
        ...(pendingMetaRef.current ?? {}),
        ...(properties ?? {}),
      })
      interactionRef.current = null
      interactionContextRef.current = null
      pendingMetaRef.current = null
    },
    []
  )

  useEffect(() => {
    if (!interactionRef.current) {
      beginInteraction('initial', selectedTimeframe)
    }

    const controller = new AbortController()
    controllerRef.current?.abort()
    controllerRef.current = controller

    setState({ status: 'loading', text: '', error: null })
    setCacheMeta(null)

    const shouldForceRefresh = refreshKey !== lastRefreshKeyRef.current
    lastRefreshKeyRef.current = refreshKey
    pendingMetaRef.current = { forceRefresh: shouldForceRefresh }

    let isStreaming = false
    let didFail = false

    async function loadSummary() {
      try {
        const response = await fetch('/api/dashboard/recent-activity/summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeframeDays: Number(selectedTimeframe),
            forceRefresh: shouldForceRefresh,
          }),
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Unable to generate summary right now.')
        }

        const responseCacheStatus =
          (response.headers.get('x-activity-overview-cache') as
            | 'hit'
            | 'miss'
            | null) ?? null

        setCacheMeta({
          cacheStatus: responseCacheStatus,
          cachedAt: response.headers.get('x-activity-overview-cached-at'),
          expiresAt: response.headers.get('x-activity-overview-expires-at'),
        })

        if (!response.body) {
          const fallbackText = await response.text()
          setState({ status: 'success', text: fallbackText, error: null })
          finishInteraction('success', {
            cacheStatus: responseCacheStatus,
            streaming: false,
            forceRefresh: shouldForceRefresh,
          })
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value, { stream: true })

          if (!chunk) {
            continue
          }

          isStreaming = true
          accumulated += chunk
          setState({ status: 'streaming', text: accumulated, error: null })
        }

        accumulated += decoder.decode()
        setState({ status: 'success', text: accumulated, error: null })
        finishInteraction('success', {
          cacheStatus: responseCacheStatus,
          streaming: isStreaming,
          forceRefresh: shouldForceRefresh,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          finishInteraction('cancelled', { reason: 'aborted' })
          return
        }

        didFail = true
        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while summarizing activity.'
        setState({ status: 'error', text: '', error: message })
        finishInteraction('error', {
          errorMessage: message,
        })
      } finally {
        if (!isStreaming && !didFail) {
          setState(current =>
            current.status === 'loading'
              ? { ...current, status: 'success' }
              : current
          )
        }
      }
    }

    void loadSummary()

    return () => {
      controller.abort()
    }
  }, [
    beginInteraction,
    finishInteraction,
    refreshKey,
    selectedTimeframe,
  ])

  const handleRefresh = useCallback(() => {
    beginInteraction('refresh', selectedTimeframe)
    setRefreshKey(key => key + 1)
  }, [beginInteraction, selectedTimeframe])

  const handleTimeframeChange = useCallback(
    (value: string) => {
      const timeframe = value as TimeframeValue
      beginInteraction('timeframe', timeframe)
      setSelectedTimeframe(timeframe)
    },
    [beginInteraction]
  )

  const metaLabel = useMemo(() => {
    if (!cacheMeta?.cachedAt || state.status === 'error') {
      return null
    }

    const cachedDate = new Date(cacheMeta.cachedAt)
    const formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const freshness = cacheMeta.cacheStatus === 'hit' ? 'Cached' : 'Fresh'

    return `${freshness} · updated ${formatter.format(cachedDate)}`
  }, [cacheMeta, state.status])

  const statusLabel: string = useMemo(() => {
    switch (state.status) {
      case 'loading':
        return 'Loading'
      case 'streaming':
        return 'Streaming'
      case 'error':
        return 'Error'
      case 'success':
        return cacheMeta?.cacheStatus === 'hit' ? 'Cached' : 'Fresh'
      default:
        return 'Idle'
    }
  }, [cacheMeta?.cacheStatus, state.status])

  return (
    <section
      className={cn(
        'bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='recent-activity-overview-heading'
    >
      <Tabs
        value={selectedTimeframe}
        onValueChange={handleTimeframeChange}
        className='flex h-full flex-col'
      >
        <header className='flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4'>
          <div>
            <h2
              id='recent-activity-overview-heading'
              className='text-base font-semibold'
            >
              Recent Activity Overview
            </h2>
            <p className='text-muted-foreground text-xs'>
              AI-generated summary of the activity logs so everyone stays
              aligned.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <TabsList className='h-9'>
              {TIMEFRAME_OPTIONS.map(option => (
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
              onClick={handleRefresh}
              disabled={
                state.status === 'loading' || state.status === 'streaming'
              }
            >
              <RefreshCw
                className={cn('size-4', {
                  'animate-spin':
                    state.status === 'loading' || state.status === 'streaming',
                })}
                aria-hidden
              />
              <span className='sr-only'>Refresh summary</span>
            </Button>
          </div>
        </header>
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

type SummaryContentProps = {
  state: SummaryState
}

function SummaryContent({ state }: SummaryContentProps) {
  if (state.status === 'error') {
    return (
      <div className='text-destructive text-sm'>
        {state.error ?? 'We were unable to load the recent activity overview.'}
      </div>
    )
  }

  if (
    state.status === 'loading' ||
    (state.status === 'streaming' && !state.text)
  ) {
    return <LoadingState />
  }

  if (!state.text.trim()) {
    return (
      <div className='text-muted-foreground text-sm'>
        No updates to share just yet. As soon as activity is captured, you’ll
        see a recap here.
      </div>
    )
  }

  return (
    <div className='prose prose-sm text-foreground dark:prose-invert max-w-none'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ul: props => (
            <ul {...props} className='mt-2 list-disc pl-4 text-sm leading-6' />
          ),
          ol: props => (
            <ol
              {...props}
              className='mt-2 list-decimal pl-4 text-sm leading-6'
            />
          ),
          p: props => <p {...props} className='text-sm leading-6' />,
          h3: props => (
            <h3
              {...props}
              className='text-foreground text-xs font-semibold tracking-wide uppercase not-first:mt-3'
            />
          ),
          strong: props => (
            <strong {...props} className='text-foreground font-semibold' />
          ),
        }}
      >
        {state.text}
      </ReactMarkdown>
    </div>
  )
}

function LoadingState() {
  return (
    <div className='space-y-3'>
      <div className='bg-muted h-3 w-4/5 animate-pulse rounded-full' />
      <div className='bg-muted h-3 w-full animate-pulse rounded-full' />
      <div className='bg-muted h-3 w-11/12 animate-pulse rounded-full' />
      <div className='bg-muted h-3 w-10/12 animate-pulse rounded-full' />
    </div>
  )
}
