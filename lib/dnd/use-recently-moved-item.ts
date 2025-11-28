import { useCallback, useEffect, useRef, useState } from 'react'

export const useRecentlyMovedItem = () => {
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleReset = useCallback(() => {
    clearTimer()

    timerRef.current = window.setTimeout(() => {
      setRecentlyMovedId(null)
      timerRef.current = null
    }, 150)
  }, [clearTimer])

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    recentlyMovedId,
    setRecentlyMovedId,
    scheduleReset,
    clearTimer,
  }
}


