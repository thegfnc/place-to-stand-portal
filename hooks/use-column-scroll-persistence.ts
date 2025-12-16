'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject, UIEventHandler } from 'react'

type UseColumnScrollPersistenceOptions = {
  storageKey: string
  columnIds: string[]
}

type ColumnScrollHandlers = {
  getColumnRef: (columnId: string) => MutableRefObject<HTMLDivElement | null>
  getScrollHandler: (columnId: string) => UIEventHandler<HTMLDivElement>
}

/**
 * Hook to persist vertical scroll position for multiple kanban columns
 * Each column's scroll position is stored separately using its column ID
 */
export function useColumnScrollPersistence({
  storageKey,
  columnIds,
}: UseColumnScrollPersistenceOptions): ColumnScrollHandlers {
  // Store refs for each column
  const columnRefsMap = useRef<Map<string, MutableRefObject<HTMLDivElement | null>>>(new Map())

  // Initialize refs for all columns
  useEffect(() => {
    columnIds.forEach(columnId => {
      if (!columnRefsMap.current.has(columnId)) {
        columnRefsMap.current.set(columnId, { current: null })
      }
    })
  }, [columnIds])

  const getStorageKey = useCallback(
    (columnId: string) => `${storageKey}-column-${columnId}`,
    [storageKey]
  )

  const persistScrollPosition = useCallback(
    (columnId: string) => {
      if (typeof window === 'undefined') {
        return
      }

      const ref = columnRefsMap.current.get(columnId)
      const node = ref?.current
      if (!node) {
        return
      }

      const value = node.scrollTop

      try {
        window.sessionStorage.setItem(getStorageKey(columnId), String(value))
      } catch {
        // Ignore storage failures (private browsing, quota, etc.)
      }
    },
    [getStorageKey]
  )

  const restoreScrollPosition = useCallback(
    (columnId: string) => {
      if (typeof window === 'undefined') {
        return
      }

      const ref = columnRefsMap.current.get(columnId)
      const node = ref?.current
      if (!node) {
        return
      }

      try {
        const stored = window.sessionStorage.getItem(getStorageKey(columnId))
        const parsed = stored ? Number(stored) : NaN
        if (!Number.isNaN(parsed)) {
          node.scrollTop = parsed
        }
      } catch {
        // Ignore storage failures (private browsing, quota, etc.)
      }
    },
    [getStorageKey]
  )

  // Restore scroll positions when refs are mounted or columnIds change
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      columnIds.forEach(columnId => {
        restoreScrollPosition(columnId)
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      // Persist all scroll positions on unmount
      columnIds.forEach(columnId => {
        persistScrollPosition(columnId)
      })
    }
  }, [columnIds, persistScrollPosition, restoreScrollPosition])

  const getColumnRef = useCallback(
    (columnId: string) => {
      let ref = columnRefsMap.current.get(columnId)
      if (!ref) {
        ref = { current: null }
        columnRefsMap.current.set(columnId, ref)
      }
      return ref
    },
    []
  )

  const getScrollHandler = useCallback(
    (columnId: string): UIEventHandler<HTMLDivElement> => {
      return () => {
        persistScrollPosition(columnId)
      }
    },
    [persistScrollPosition]
  )

  return {
    getColumnRef,
    getScrollHandler,
  }
}
