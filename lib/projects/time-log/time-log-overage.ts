'use client'

import { useCallback, useMemo, useState } from 'react'

type PendingAction = {
  hours: number
  action: () => void
}

export type UseTimeLogOverageOptions = {
  clientRemainingHours: number | null
}

export type UseTimeLogOverageResult = {
  requestConfirmation: (hours: number, action: () => void) => boolean
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
  const { clientRemainingHours } = options

  const [pending, setPending] = useState<PendingAction | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const reset = useCallback(() => {
    setPending(null)
    setIsOpen(false)
  }, [])

  const requestConfirmation = useCallback(
    (hours: number, action: () => void) => {
      if (
        clientRemainingHours === null ||
        !Number.isFinite(hours) ||
        hours <= 0 ||
        hours <= clientRemainingHours
      ) {
        return false
      }

      setPending({ hours, action })
      setIsOpen(true)
      return true
    },
    [clientRemainingHours]
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
    const pendingHours = pending?.hours ?? null

    if (pendingHours === null || clientRemainingHours === null) {
      return "This log will exceed the client's remaining hours. Continue anyway?"
    }

    const remainingAfter = clientRemainingHours - pendingHours
    return `Logging ${pendingHours.toFixed(2)} hrs will push the client balance to ${remainingAfter.toFixed(2)} hrs. Continue?`
  }, [clientRemainingHours, pending])

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
