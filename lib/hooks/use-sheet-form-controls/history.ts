'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FieldValues } from 'react-hook-form'

import { cloneData, cloneValues } from './clone'
import type { FormHistoryArgs, FormHistoryReturn, FormSnapshot } from './types'

const DEFAULT_MAX_SNAPSHOTS = 100
const DEFAULT_DEBOUNCE_MS = 300

export function useFormHistory<T extends FieldValues>({
  form,
  isActive,
  historyKey,
  maxSnapshots,
  debounceMs,
  getExternalState,
  applyExternalState,
}: FormHistoryArgs<T>): FormHistoryReturn {
  const historyRef = useRef<FormSnapshot<T>[]>([])
  const indexRef = useRef(-1)
  const isApplyingRef = useRef(false)
  const pendingSnapshotRef = useRef<{
    values: T
    externalState?: unknown
  } | null>(null)
  const debounceTimerRef = useRef<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const effectiveMaxSnapshots = maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS
  const effectiveDebounceMs = debounceMs ?? DEFAULT_DEBOUNCE_MS

  const clearPendingTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const buildSnapshot = useCallback(
    (values: T, externalState?: unknown): FormSnapshot<T> => {
      const clonedValues = cloneValues(values)
      const clonedExternal =
        externalState !== undefined ? cloneData(externalState) : undefined
      const signaturePayload = {
        v: clonedValues,
        e: clonedExternal ?? null,
      }

      return {
        values: clonedValues,
        externalState: clonedExternal,
        signature: JSON.stringify(signaturePayload),
      }
    },
    []
  )

  const refreshCapabilities = useCallback(() => {
    setCanUndo(indexRef.current > 0)
    setCanRedo(
      indexRef.current >= 0 && indexRef.current < historyRef.current.length - 1
    )
  }, [])

  const pushSnapshot = useCallback(
    (values: T, externalState?: unknown) => {
      const snapshot = buildSnapshot(values, externalState)
      const currentHistory = historyRef.current
      const currentIndex = indexRef.current
      const currentSnapshot = currentHistory[currentIndex]

      if (currentSnapshot && currentSnapshot.signature === snapshot.signature) {
        return
      }

      const nextHistory =
        currentIndex < currentHistory.length - 1
          ? currentHistory.slice(0, currentIndex + 1)
          : currentHistory.slice()

      nextHistory.push(snapshot)

      if (nextHistory.length > effectiveMaxSnapshots) {
        const overflow = nextHistory.length - effectiveMaxSnapshots
        nextHistory.splice(0, overflow)
        indexRef.current = nextHistory.length - 1
      } else {
        indexRef.current = nextHistory.length - 1
      }

      historyRef.current = nextHistory
      refreshCapabilities()
    },
    [buildSnapshot, effectiveMaxSnapshots, refreshCapabilities]
  )

  const flushPendingSnapshots = useCallback(() => {
    if (!pendingSnapshotRef.current) {
      clearPendingTimer()
      return
    }

    const snapshot = pendingSnapshotRef.current
    pendingSnapshotRef.current = null
    clearPendingTimer()
    pushSnapshot(snapshot.values, snapshot.externalState)
  }, [clearPendingTimer, pushSnapshot])

  const applySnapshot = useCallback(
    (snapshot: FormSnapshot<T>, nextIndex: number) => {
      isApplyingRef.current = true
      flushPendingSnapshots()
      form.reset(cloneValues(snapshot.values))

      if (applyExternalState) {
        applyExternalState(snapshot.externalState ?? null)
      }

      indexRef.current = nextIndex
      refreshCapabilities()
      const releaseFlag = () => {
        isApplyingRef.current = false
      }

      if (typeof queueMicrotask === 'function') {
        queueMicrotask(releaseFlag)
      } else {
        Promise.resolve().then(releaseFlag)
      }
    },
    [applyExternalState, flushPendingSnapshots, form, refreshCapabilities]
  )

  const resetHistory = useCallback(
    (values: T, externalState?: unknown) => {
      flushPendingSnapshots()
      const snapshot = buildSnapshot(values, externalState)

      historyRef.current = [snapshot]
      indexRef.current = 0
      refreshCapabilities()
    },
    [buildSnapshot, flushPendingSnapshots, refreshCapabilities]
  )

  const scheduleSnapshot = useCallback(
    (values: T, externalState?: unknown) => {
      if (!isActive || isApplyingRef.current) {
        return
      }

      if (effectiveDebounceMs <= 0) {
        pushSnapshot(values, externalState)
        return
      }

      pendingSnapshotRef.current = {
        values: cloneValues(values),
        externalState:
          externalState !== undefined ? cloneData(externalState) : undefined,
      }
      clearPendingTimer()
      debounceTimerRef.current = window.setTimeout(() => {
        if (!pendingSnapshotRef.current) {
          return
        }
        const snapshot = pendingSnapshotRef.current
        pendingSnapshotRef.current = null
        pushSnapshot(snapshot.values, snapshot.externalState)
      }, effectiveDebounceMs)
    },
    [clearPendingTimer, effectiveDebounceMs, isActive, pushSnapshot]
  )

  const undo = useCallback(() => {
    flushPendingSnapshots()
    if (indexRef.current <= 0) {
      return
    }

    const nextIndex = indexRef.current - 1
    const snapshot = historyRef.current[nextIndex]

    if (!snapshot) {
      return
    }

    applySnapshot(snapshot, nextIndex)
  }, [applySnapshot, flushPendingSnapshots])

  const redo = useCallback(() => {
    flushPendingSnapshots()
    if (indexRef.current >= historyRef.current.length - 1) {
      return
    }

    const nextIndex = indexRef.current + 1
    const snapshot = historyRef.current[nextIndex]

    if (!snapshot) {
      return
    }

    applySnapshot(snapshot, nextIndex)
  }, [applySnapshot, flushPendingSnapshots])

  useEffect(() => {
    if (!isActive) {
      flushPendingSnapshots()
      return
    }

    resetHistory(form.getValues(), getExternalState?.())

    const subscription = form.watch(value => {
      if (isApplyingRef.current) {
        return
      }

      scheduleSnapshot(value as T, getExternalState?.())
    })

    return () => {
      subscription.unsubscribe()
      flushPendingSnapshots()
    }
  }, [
    flushPendingSnapshots,
    form,
    getExternalState,
    historyKey,
    isActive,
    resetHistory,
    scheduleSnapshot,
  ])

  const notifyExternalChange = useCallback(() => {
    if (!isActive) {
      return
    }

    scheduleSnapshot(form.getValues(), getExternalState?.())
  }, [form, getExternalState, isActive, scheduleSnapshot])

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    flushPendingSnapshots,
    notifyExternalChange,
  }
}
