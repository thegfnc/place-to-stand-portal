'use client'

import { useCallback, useMemo, useState } from 'react'

type PendingAction = {
  nextHours: number
  deltaHours: number
  remainingAfter: number | null
  isEditUpdate: boolean
  action: () => void
}

type OverageConfirmationRequest = {
  nextHours: number
  previousHours?: number | null
  action: () => void
}

export type UseTimeLogOverageOptions = {
  clientRemainingHours: number | null
  enforceOverageCheck?: boolean
}

export type UseTimeLogOverageResult = {
  requestConfirmation: (request: OverageConfirmationRequest) => boolean
  reset: () => void
  overageDialog: {
    isOpen: boolean
    description: string
    confirm: () => void
    cancel: () => void
  }
}

export function useTimeLogOverage(
  options: UseTimeLogOverageOptions
): UseTimeLogOverageResult {
  const { clientRemainingHours, enforceOverageCheck = true } = options

  const [pending, setPending] = useState<PendingAction | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const reset = useCallback(() => {
    setPending(null)
    setIsOpen(false)
  }, [])

  const requestConfirmation = useCallback(
    (request: OverageConfirmationRequest) => {
      if (!enforceOverageCheck) {
        return false
      }

      const { nextHours, previousHours = 0, action } = request

      if (clientRemainingHours === null) {
        return false
      }

      if (!Number.isFinite(nextHours) || nextHours <= 0) {
        return false
      }

      const normalizedPrevious = Number.isFinite(previousHours ?? Number.NaN)
        ? Math.max(previousHours ?? 0, 0)
        : 0
      const deltaHours = Math.max(nextHours - normalizedPrevious, 0)

      if (deltaHours === 0) {
        return false
      }

      if (deltaHours <= clientRemainingHours) {
        return false
      }

      const remainingAfter = clientRemainingHours - deltaHours
      const isEditUpdate = normalizedPrevious > 0

      setPending({
        nextHours,
        deltaHours,
        remainingAfter,
        isEditUpdate,
        action,
      })
      setIsOpen(true)
      return true
    },
    [clientRemainingHours, enforceOverageCheck]
  )

  const confirm = useCallback(() => {
    if (!pending) {
      return
    }

    const next = pending.action
    reset()
    next()
  }, [pending, reset])

  const cancel = useCallback(() => {
    reset()
  }, [reset])

  const description = useMemo(() => {
    if (!pending) {
      return "This log will exceed the client's remaining hours. Continue anyway?"
    }

    if (pending.remainingAfter === null) {
      return "This log will exceed the client's remaining hours. Continue anyway?"
    }

    const { nextHours, deltaHours, remainingAfter, isEditUpdate } = pending

    if (isEditUpdate) {
      return `Updating this log to ${nextHours.toFixed(2)} hrs adds ${deltaHours.toFixed(2)} hrs and will push the client balance to ${remainingAfter.toFixed(2)} hrs. Continue?`
    }

    return `Logging ${nextHours.toFixed(2)} hrs will push the client balance to ${remainingAfter.toFixed(2)} hrs. Continue?`
  }, [pending])

  const overageDialog = useMemo(
    () => ({
      isOpen,
      description,
      confirm,
      cancel,
    }),
    [cancel, confirm, description, isOpen]
  )

  return {
    requestConfirmation,
    reset,
    overageDialog,
  }
}
