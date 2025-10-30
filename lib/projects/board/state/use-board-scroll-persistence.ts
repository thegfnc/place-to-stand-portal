import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { UIEventHandler } from 'react'

type UseBoardScrollPersistenceOptions = {
  activeProjectId: string | null
}

type UseBoardScrollPersistenceReturn = {
  boardViewportRef: React.MutableRefObject<HTMLDivElement | null>
  handleBoardScroll: UIEventHandler<HTMLDivElement>
}

export function useBoardScrollPersistence(
  options: UseBoardScrollPersistenceOptions
): UseBoardScrollPersistenceReturn {
  const { activeProjectId } = options
  const boardViewportRef = useRef<HTMLDivElement | null>(null)

  const boardScrollKey = useMemo(() => {
    if (!activeProjectId) return null
    return `projects-board-scroll:${activeProjectId}`
  }, [activeProjectId])

  const persistBoardScroll = useCallback(() => {
    if (!boardScrollKey) {
      return
    }

    const node = boardViewportRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    try {
      window.sessionStorage.setItem(boardScrollKey, String(node.scrollLeft))
    } catch {
      // Ignore storage failures (private browsing, quota, etc.)
    }
  }, [boardScrollKey])

  const handleBoardScroll = useCallback<UIEventHandler<HTMLDivElement>>(() => {
    persistBoardScroll()
  }, [persistBoardScroll])

  useEffect(() => {
    if (!boardScrollKey) {
      return
    }

    const node = boardViewportRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.sessionStorage.getItem(boardScrollKey)
        const parsed = stored ? Number(stored) : NaN
        if (!Number.isNaN(parsed)) {
          node.scrollLeft = parsed
        }
      } catch {
        // Ignore storage failures (private browsing, quota, etc.)
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
      persistBoardScroll()
    }
  }, [boardScrollKey, persistBoardScroll])

  return {
    boardViewportRef,
    handleBoardScroll,
  }
}
