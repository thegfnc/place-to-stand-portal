'use client'

import { useEffect, useRef } from 'react'

import { startClientInteraction } from '@/lib/posthog/client'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'
import type { InteractionHandle } from '@/lib/perf/interaction-marks'

type ResumeSource = 'visibilitychange' | 'focus'

const RESUME_DEBOUNCE_MS = 500

export function IdleResumeTracker() {
  const lastHiddenAtRef = useRef<number | null>(null)
  const lastResumeAtRef = useRef<number>(0)
  const interactionRef = useRef<InteractionHandle | null>(null)
  const contextRef = useRef<{
    source: ResumeSource
    hiddenDuration: number | null
    visibilityState: DocumentVisibilityState
  } | null>(null)

  useEffect(() => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      lastHiddenAtRef.current = performance.now()
    }

    function endInteraction(
      status: 'success' | 'error' | 'cancelled',
      properties?: Record<string, unknown>
    ) {
      if (!interactionRef.current) {
        return
      }

      interactionRef.current.end({
        status,
        ...(contextRef.current ?? {}),
        ...(properties ?? {}),
      })
      interactionRef.current = null
      contextRef.current = null
    }

    function startResumeInteraction(source: ResumeSource) {
      const now = performance.now()

      if (
        source === 'focus' &&
        now - lastResumeAtRef.current < RESUME_DEBOUNCE_MS
      ) {
        return
      }

      const hiddenDuration =
        lastHiddenAtRef.current !== null ? now - lastHiddenAtRef.current : null

      const metadata = {
        source,
        hiddenDuration,
        page: window.location.pathname,
        visibilityState: document.visibilityState,
        online: navigator.onLine,
      }

      interactionRef.current?.end({
        status: 'replaced',
        ...metadata,
      })

      interactionRef.current = startClientInteraction(
        INTERACTION_EVENTS.IDLE_RESUME,
        {
          metadata,
          baseProperties: metadata,
        }
      )

      contextRef.current = {
        source,
        hiddenDuration,
        visibilityState: document.visibilityState,
      }

      lastResumeAtRef.current = now
      lastHiddenAtRef.current = null

      void requestAnimationFrame(() => {
        void requestAnimationFrame(() => {
          endInteraction('success', {
            completionTimestamp: Date.now(),
            online: navigator.onLine,
          })
        })
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = performance.now()
        endInteraction('cancelled', { reason: 'hidden' })
        return
      }

      startResumeInteraction('visibilitychange')
    }

    function handleFocus() {
      if (document.visibilityState !== 'visible') {
        return
      }

      startResumeInteraction('focus')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      endInteraction('cancelled', { reason: 'cleanup' })
    }
  }, [])

  return null
}
