'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import {
  destroyClient,
  restoreClient,
  softDeleteClient,
} from '@/app/(dashboard)/clients/actions'

import type { ClientRow } from './client-sheet-utils'
import { useClientSheetSelection } from './use-client-sheet-selection'
import { PENDING_REASON } from '@/lib/forms/form-controls'
export type ClientsTableClient = ClientRow & {
  metrics: {
    active_projects: number
    total_projects: number
  }
}

type UseClientsTableStateArgs = {
  /** The page's fresh rows — the open sheet re-resolves from them by id. */
  clients: ClientsTableClient[]
  /** Row resolved server-side from `?client=`, used when the list misses it. */
  deepLinkedClient?: ClientRow | null
}

export function useClientsTableState({
  clients,
  deepLinkedClient = null,
}: UseClientsTableStateArgs) {
  const router = useRouter()
  const {
    selectedId,
    sheetOpen,
    sheetClient,
    openCreate,
    openEdit,
    clear,
    handleSheetOpenChange,
    handleSheetComplete,
  } = useClientSheetSelection({ clients, deepLinkedClient })
  const [deleteTarget, setDeleteTarget] = useState<ClientsTableClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] = useState<ClientsTableClient | null>(
    null
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const pendingReason = PENDING_REASON

  /**
   * The row is about to leave this tab — drop `?client=` first so the refresh
   * can't reopen a stale sheet or trip the not-found notice.
   */
  const clearIfSelected = (clientId: string) => {
    if (selectedId === clientId) {
      clear()
    }
  }

  const handleRequestDelete = (client: ClientsTableClient) => {
    if (client.deleted_at || isPending) {
      return
    }

    setDeleteTarget(client)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const client = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(client.id)

    startTransition(async () => {
      try {
        const result = await softDeleteClient({ id: client.id })

        if (result.error) {
          toast({
            title: 'Unable to delete client',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Client deleted',
          description: `${client.name} is hidden from selectors but remains available for history.`,
        })
        clearIfSelected(client.id)
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (client: ClientsTableClient) => {
    if (!client.deleted_at || isPending) {
      return
    }

    setPendingRestoreId(client.id)
    startTransition(async () => {
      try {
        const result = await restoreClient({ id: client.id })

        if (result.error) {
          toast({
            title: 'Unable to restore client',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Client restored',
          description: `${client.name} is active again.`,
        })
        clearIfSelected(client.id)
        router.refresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (client: ClientsTableClient) => {
    if (!client.deleted_at || isPending) {
      return
    }

    setDestroyTarget(client)
  }

  const handleCancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deleted_at) {
      setDestroyTarget(null)
      return
    }

    const client = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(client.id)

    startTransition(async () => {
      try {
        const result = await destroyClient({ id: client.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete client',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Client permanently deleted',
          description: `${client.name} has been removed.`,
        })
        clearIfSelected(client.id)
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return {
    sheetOpen,
    selectedClient: sheetClient,
    deleteTarget,
    destroyTarget,
    isPending,
    pendingReason,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    openCreate,
    openEdit,
    clearSelection: clear,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRestore,
    handleRequestDestroy,
    handleCancelDestroy,
    handleConfirmDestroy,
  }
}
