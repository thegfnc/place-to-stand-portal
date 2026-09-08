"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { startClientInteraction } from "@/lib/posthog/client"
import { INTERACTION_EVENTS } from "@/lib/posthog/types"
import type { InteractionHandle } from "@/lib/perf/interaction-marks"

import {
  DEFAULT_TIMEFRAME_VALUE,
  TIMEFRAME_OPTIONS,
  type TimeframeValue,
} from "./constants"

type SummaryStatus = "idle" | "loading" | "success" | "error"

type ActivityMetrics = {
  tasksDone: number
  newLeads: number
  activeProjects: number
  blockedTasks: number
}

export type SummaryState = {
  status: SummaryStatus
  metrics: ActivityMetrics | null
  highlight: string
  error: string | null
}

type CacheMeta = {
  cacheStatus: "hit" | "miss" | null
  cachedAt?: string | null
  expiresAt?: string | null
} | null

type InteractionTrigger = "initial" | "refresh" | "timeframe"

type UseRecentActivitySummaryReturn = {
  state: SummaryState
  selectedTimeframe: TimeframeValue
  statusLabel: string
  metaLabel: string | null
  isBusy: boolean
  refresh: () => void
  changeTimeframe: (value: TimeframeValue) => void
}

export function useRecentActivitySummary(
  initialTimeframe: TimeframeValue = DEFAULT_TIMEFRAME_VALUE
): UseRecentActivitySummaryReturn {
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<TimeframeValue>(initialTimeframe)
  const [refreshKey, setRefreshKey] = useState(0)
  // Starts in "loading": the fetch effect always kicks off on mount.
  const [state, setState] = useState<SummaryState>({
    status: "loading",
    metrics: null,
    highlight: "",
    error: null,
  })
  const [cacheMeta, setCacheMeta] = useState<CacheMeta>(null)

  // Reset to loading whenever the fetch inputs change, using the
  // adjust-state-during-render pattern instead of a sync setState in the
  // fetch effect below.
  const fetchKey = `${selectedTimeframe}:${refreshKey}`
  const [prevFetchKey, setPrevFetchKey] = useState(fetchKey)
  if (prevFetchKey !== fetchKey) {
    setPrevFetchKey(fetchKey)
    setState({ status: "loading", metrics: null, highlight: "", error: null })
    setCacheMeta(null)
  }

  const controllerRef = useRef<AbortController | null>(null)
  const lastRefreshKeyRef = useRef(refreshKey)
  const interactionRef = useRef<InteractionHandle | null>(null)
  const interactionContextRef = useRef<{
    trigger: InteractionTrigger
    timeframe: TimeframeValue
  } | null>(null)
  const pendingMetaRef = useRef<{ forceRefresh: boolean } | null>(null)

  const beginInteraction = useCallback(
    (trigger: InteractionTrigger, timeframe: TimeframeValue) => {
      const base = {
        widget: "recent_activity_overview",
        trigger,
        timeframe,
      }

      interactionRef.current?.end({
        status: "replaced",
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
      status: "success" | "error" | "cancelled",
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
      beginInteraction("initial", selectedTimeframe)
    }

    const controller = new AbortController()
    controllerRef.current?.abort()
    controllerRef.current = controller

    const shouldForceRefresh = refreshKey !== lastRefreshKeyRef.current
    lastRefreshKeyRef.current = refreshKey
    pendingMetaRef.current = { forceRefresh: shouldForceRefresh }

    async function loadSummary() {
      try {
        const response = await fetch("/api/dashboard/recent-activity/summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeframeDays: Number(selectedTimeframe),
            forceRefresh: shouldForceRefresh,
          }),
          signal: controller.signal,
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Unable to generate summary right now.")
        }

        const responseCacheStatus =
          (response.headers.get("x-activity-overview-cache") as
            | "hit"
            | "miss"
            | null) ?? null

        setCacheMeta({
          cacheStatus: responseCacheStatus,
          cachedAt: response.headers.get("x-activity-overview-cached-at"),
          expiresAt: response.headers.get("x-activity-overview-expires-at"),
        })

        const data = (await response.json()) as {
          metrics: ActivityMetrics
          highlight: string
        }

        setState({
          status: "success",
          metrics: data.metrics,
          highlight: data.highlight,
          error: null,
        })
        finishInteraction("success", {
          cacheStatus: responseCacheStatus,
          forceRefresh: shouldForceRefresh,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          finishInteraction("cancelled", { reason: "aborted" })
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : "Something went wrong while summarizing activity."
        setState({
          status: "error",
          metrics: null,
          highlight: "",
          error: message,
        })
        finishInteraction("error", {
          errorMessage: message,
        })
      }
    }

    void loadSummary()

    return () => {
      controller.abort()
    }
  }, [beginInteraction, finishInteraction, refreshKey, selectedTimeframe])

  const refresh = useCallback(() => {
    beginInteraction("refresh", selectedTimeframe)
    setRefreshKey((key) => key + 1)
  }, [beginInteraction, selectedTimeframe])

  const changeTimeframe = useCallback(
    (value: TimeframeValue) => {
      if (value === selectedTimeframe) {
        return
      }

      const isValidOption = TIMEFRAME_OPTIONS.some(
        (option) => option.value === value
      )
      if (!isValidOption) {
        return
      }

      beginInteraction("timeframe", value)
      setSelectedTimeframe(value)
    },
    [beginInteraction, selectedTimeframe]
  )

  const statusLabel = useMemo(() => {
    switch (state.status) {
      case "loading":
        return "Loading"
      case "error":
        return "Error"
      case "success":
        return cacheMeta?.cacheStatus === "hit" ? "Cached" : "Fresh"
      default:
        return "Idle"
    }
  }, [cacheMeta?.cacheStatus, state.status])

  const metaLabel = useMemo(() => {
    if (!cacheMeta?.cachedAt || state.status === "error") {
      return null
    }

    const cachedDate = new Date(cacheMeta.cachedAt)
    const formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })

    const freshness = cacheMeta.cacheStatus === "hit" ? "Cached" : "Fresh"

    return `${freshness} · updated ${formatter.format(cachedDate)}`
  }, [cacheMeta, state.status])

  const isBusy = state.status === "loading"

  return {
    state,
    selectedTimeframe,
    statusLabel,
    metaLabel,
    isBusy,
    refresh,
    changeTimeframe,
  }
}

