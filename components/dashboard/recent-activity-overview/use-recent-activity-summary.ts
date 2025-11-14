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

export type SummaryStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "success"
  | "error"

export type SummaryState = {
  status: SummaryStatus
  text: string
  error: string | null
}

export type CacheMeta = {
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
  const [state, setState] = useState<SummaryState>({
    status: "idle",
    text: "",
    error: null,
  })
  const [cacheMeta, setCacheMeta] = useState<CacheMeta>(null)

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

    setState({ status: "loading", text: "", error: null })
    setCacheMeta(null)

    const shouldForceRefresh = refreshKey !== lastRefreshKeyRef.current
    lastRefreshKeyRef.current = refreshKey
    pendingMetaRef.current = { forceRefresh: shouldForceRefresh }

    let isStreaming = false
    let didFail = false

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

        if (!response.body) {
          const fallbackText = await response.text()
          setState({ status: "success", text: fallbackText, error: null })
          finishInteraction("success", {
            cacheStatus: responseCacheStatus,
            streaming: false,
            forceRefresh: shouldForceRefresh,
          })
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

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
          setState({ status: "streaming", text: accumulated, error: null })
        }

        accumulated += decoder.decode()
        setState({ status: "success", text: accumulated, error: null })
        finishInteraction("success", {
          cacheStatus: responseCacheStatus,
          streaming: isStreaming,
          forceRefresh: shouldForceRefresh,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          finishInteraction("cancelled", { reason: "aborted" })
          return
        }

        didFail = true
        const message =
          error instanceof Error
            ? error.message
            : "Something went wrong while summarizing activity."
        setState({ status: "error", text: "", error: message })
        finishInteraction("error", {
          errorMessage: message,
        })
      } finally {
        if (!isStreaming && !didFail) {
          setState((current) =>
            current.status === "loading"
              ? { ...current, status: "success" }
              : current
          )
        }
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
      case "streaming":
        return "Streaming"
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

  const isBusy = state.status === "loading" || state.status === "streaming"

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

