import { useCallback, useState } from 'react'

import { softDeleteClient } from '@/app/(dashboard)/settings/clients/actions'
import { startClientInteraction } from '@/lib/posthog/client'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'

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
      const interaction = startClientInteraction(
        INTERACTION_EVENTS.SETTINGS_SAVE,
        {
          metadata: {
            entity: 'client',
            mode: 'delete',
            clientId: client.id,
          },
          baseProperties: {
            entity: 'client',
            mode: 'delete',
            clientId: client.id,
          },
        }
      )

      try {
        const result = await softDeleteClient({ id: client.id })

        if (result.error) {
          interaction.end({
            status: 'error',
            entity: 'client',
            mode: 'delete',
            clientId: client.id,
            error: result.error,
          })
          setFeedback(result.error)
          return
        }

        interaction.end({
          status: 'success',
          entity: 'client',
          mode: 'delete',
          clientId: client.id,
        })

        toast({
          title: 'Client deleted',
          description: `${client.name} is hidden from selectors but remains available for history.`,
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        interaction.end({
          status: 'error',
          entity: 'client',
          mode: 'delete',
          clientId: client.id,
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
