import { useCallback, useState } from 'react'

import { softDeleteClient } from '@/app/(dashboard)/settings/clients/actions'

import { PENDING_REASON } from '../client-sheet-constants'

import type { ClientDeletionStateArgs, DeletionState } from './types'

export function useClientDeletionState({
  client,
  isPending,
  startTransition,
  setFeedback,
  onOpenChange,
  onComplete,
  toast,
}: ClientDeletionStateArgs): DeletionState {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleRequestDelete = useCallback(() => {
    if (!client || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [client, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!client || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      const result = await softDeleteClient({ id: client.id })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      toast({
        title: 'Client deleted',
        description: `${client.name} is hidden from selectors but remains available for history.`,
      })

      onOpenChange(false)
      onComplete()
    })
  }, [
    client,
    isPending,
    onComplete,
    onOpenChange,
    setFeedback,
    startTransition,
    toast,
  ])

  return {
    isDeleteDialogOpen,
    deleteDisabled: isPending,
    deleteDisabledReason: isPending ? PENDING_REASON : null,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}
