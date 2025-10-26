'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

const DEFAULT_MAX_SNAPSHOTS = 100
const DEFAULT_DEBOUNCE_MS = 300

const cloneValues = <T extends FieldValues>(values: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(values)
  }

  return JSON.parse(JSON.stringify(values)) as T
}

const cloneData = <T>(value: T): T => {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

type FormSnapshot<T extends FieldValues> = {
  values: T
  externalState?: unknown
  signature: string
}

type UseSheetFormControlsOptions<T extends FieldValues> = {
  form: UseFormReturn<T>
  isActive: boolean
  canSave: boolean
  onSave: () => void
  historyKey: string | number
  maxSnapshots?: number
  debounceMs?: number
  getExternalState?: () => unknown
  applyExternalState?: (state: unknown) => void
}

type UseSheetFormControlsReturn = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  notifyExternalChange: () => void
}

export function useSheetFormControls<T extends FieldValues>(
  options: UseSheetFormControlsOptions<T>
): UseSheetFormControlsReturn {
  const {
    form,
    isActive,
    canSave,
    onSave,
    historyKey,
    maxSnapshots,
    debounceMs,
    getExternalState,
    applyExternalState,
  } = options
  const historyRef = useRef<FormSnapshot<T>[]>([])
  const indexRef = useRef(-1)
  const isApplyingRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const pendingSnapshotRef = useRef<{
    values: T
    externalState?: unknown
  } | null>(null)
  const debounceTimerRef = useRef<number | null>(null)

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

  const flushPendingSnapshot = useCallback(() => {
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
      flushPendingSnapshot()
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
    [applyExternalState, flushPendingSnapshot, form, refreshCapabilities]
  )

  const resetHistory = useCallback(
    (values: T, externalState?: unknown) => {
      flushPendingSnapshot()
      const snapshot = buildSnapshot(values, externalState)

      historyRef.current = [snapshot]
      indexRef.current = 0
      refreshCapabilities()
    },
    [buildSnapshot, flushPendingSnapshot, refreshCapabilities]
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
    flushPendingSnapshot()
    if (indexRef.current <= 0) {
      return
    }

    const nextIndex = indexRef.current - 1
    const snapshot = historyRef.current[nextIndex]

    if (!snapshot) {
      return
    }

    applySnapshot(snapshot, nextIndex)
  }, [applySnapshot, flushPendingSnapshot])

  const redo = useCallback(() => {
    flushPendingSnapshot()
    if (indexRef.current >= historyRef.current.length - 1) {
      return
    }

    const nextIndex = indexRef.current + 1
    const snapshot = historyRef.current[nextIndex]

    if (!snapshot) {
      return
    }

    applySnapshot(snapshot, nextIndex)
  }, [applySnapshot, flushPendingSnapshot])

  useEffect(() => {
    if (!isActive) {
      flushPendingSnapshot()
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
      flushPendingSnapshot()
    }
  }, [
    flushPendingSnapshot,
    form,
    getExternalState,
    historyKey,
    isActive,
    resetHistory,
    scheduleSnapshot,
  ])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const hasMeta = event.metaKey
      const hasCtrl = event.ctrlKey
      const modifierActive = hasMeta || hasCtrl

      if (!modifierActive) {
        return
      }

      if (key === 's') {
        if (!canSave) {
          return
        }

        event.preventDefault()
        flushPendingSnapshot()
        onSave()
        return
      }

      if (key === 'z') {
        if (event.shiftKey) {
          flushPendingSnapshot()
          if (indexRef.current >= historyRef.current.length - 1) {
            return
          }

          event.preventDefault()
          redo()
          return
        }

        if (indexRef.current <= 0) {
          return
        }

        event.preventDefault()
        flushPendingSnapshot()
        undo()
        return
      }

      if (key === 'y' && hasCtrl && !hasMeta) {
        flushPendingSnapshot()
        if (indexRef.current >= historyRef.current.length - 1) {
          return
        }

        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      flushPendingSnapshot()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [canSave, flushPendingSnapshot, isActive, onSave, redo, undo])

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
    notifyExternalChange,
  }
}
