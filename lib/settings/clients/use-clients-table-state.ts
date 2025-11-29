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

export type ClientsTab = 'clients' | 'archive' | 'activity'

export type ClientsTableClient = ClientRow & {
  metrics: {
    active_projects: number
    total_projects: number
  }
}

export function useClientsTableState() {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedClient, setSelectedClient] =
    useState<ClientsTableClient | null>(null)
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

  const pendingReason = 'Please wait for the current request to finish.'

  const openCreate = () => {
    setSelectedClient(null)
    setSheetOpen(true)
  }

  const openEdit = (client: ClientsTableClient) => {
    setSelectedClient(client)
    setSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setSelectedClient(null)
    }
  }

  const handleSheetComplete = () => {
    setSheetOpen(false)
    setSelectedClient(null)
    router.refresh()
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
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return {
    sheetOpen,
    selectedClient,
    deleteTarget,
    destroyTarget,
    isPending,
    pendingReason,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    openCreate,
    openEdit,
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
