'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject, UIEventHandler } from 'react'

type UseScrollPersistenceOptions = {
  storageKey: string | null
  axis?: 'x' | 'y'
}

type UseScrollPersistenceReturn = {
  viewportRef: MutableRefObject<HTMLDivElement | null>
  handleScroll: UIEventHandler<HTMLDivElement>
}

export function useScrollPersistence({
  storageKey,
  axis = 'x',
}: UseScrollPersistenceOptions): UseScrollPersistenceReturn {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const isVertical = axis === 'y'

  const persistScrollPosition = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') {
      return
    }

    const node = viewportRef.current
    if (!node) {
      return
    }

    const value = isVertical ? node.scrollTop : node.scrollLeft

    try {
      window.sessionStorage.setItem(storageKey, String(value))
    } catch {
      // Ignore storage failures (private browsing, quota, etc.)
    }
  }, [isVertical, storageKey])

  const handleScroll = useCallback<UIEventHandler<HTMLDivElement>>(() => {
    persistScrollPosition()
  }, [persistScrollPosition])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return
    }

    const node = viewportRef.current
    if (!node) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.sessionStorage.getItem(storageKey)
        const parsed = stored ? Number(stored) : NaN
        if (!Number.isNaN(parsed)) {
          if (isVertical) {
            node.scrollTop = parsed
          } else {
            node.scrollLeft = parsed
          }
        }
      } catch {
        // Ignore storage failures (private browsing, quota, etc.)
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
      persistScrollPosition()
    }
  }, [isVertical, persistScrollPosition, storageKey])

  return {
    viewportRef,
    handleScroll,
  }
}
