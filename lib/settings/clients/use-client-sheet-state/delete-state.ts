import { useCallback, useState } from 'react'

import { softDeleteClient } from '@/app/(dashboard)/clients/actions'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

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
      const interaction = startSettingsInteraction({
        entity: 'client',
        mode: 'delete',
        targetId: client.id,
      })

      try {
        const result = await softDeleteClient({ id: client.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: client.id,
            error: result.error,
          })
          setFeedback(result.error)
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: client.id,
        })

        toast({
          title: 'Client deleted',
          description: `${client.name} is hidden from selectors but remains available for history.`,
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: client.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        setFeedback('We could not delete this client. Please try again.')
      }
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
