'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import {
  destroyHourBlock,
  restoreHourBlock,
  softDeleteHourBlock,
} from '@/app/(dashboard)/settings/hour-blocks/actions'
import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'

export type HourBlocksTab = 'hour-blocks' | 'archive' | 'activity'

type UseHourBlocksTableStateArgs = {
  hourBlocks: HourBlockWithClient[]
  clients: ClientRow[]
}

const pendingReason = 'Please wait for the current request to finish.'

export function useHourBlocksTableState({
  hourBlocks,
  clients,
}: UseHourBlocksTableStateArgs) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedBlock, setSelectedBlock] =
    useState<HourBlockWithClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HourBlockWithClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] =
    useState<HourBlockWithClient | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<HourBlocksTab>('hour-blocks')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const { activeBlocks, archivedBlocks } = useMemo(() => {
    const sorted = [...hourBlocks].sort((a, b) => {
      const clientNameA = a.client?.name ?? ''
      const clientNameB = b.client?.name ?? ''

      if (clientNameA.toLocaleLowerCase() === clientNameB.toLocaleLowerCase()) {
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      }

      return clientNameA.localeCompare(clientNameB, undefined, {
        sensitivity: 'base',
      })
    })

    const active = sorted.filter(block => !block.deleted_at)
    const archived = sorted.filter(block => Boolean(block.deleted_at))

    return { activeBlocks: active, archivedBlocks: archived }
  }, [hourBlocks])

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Create a client before logging hour blocks.'
    : null

  const openCreate = () => {
    setSelectedBlock(null)
    setSheetOpen(true)
  }

  const openEdit = (block: HourBlockWithClient) => {
    setSelectedBlock(block)
    setSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setSelectedBlock(null)
    }
  }

  const handleComplete = () => {
    setSheetOpen(false)
    setSelectedBlock(null)
    router.refresh()
  }

  const handleRequestDelete = (block: HourBlockWithClient) => {
    if (block.deleted_at || isPending) {
      return
    }

    setDeleteTarget(block)
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

    const block = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(block.id)

    startTransition(async () => {
      try {
        const result = await softDeleteHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block archived',
          description:
            'The hour block is hidden from active tracking but remains in history.',
        })
        router.refresh()
        setActiveTab('archive')
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (block: HourBlockWithClient) => {
    if (!block.deleted_at || isPending) {
      return
    }

    setPendingRestoreId(block.id)

    startTransition(async () => {
      try {
        const result = await restoreHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to restore hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block restored',
          description: 'The hour block is active again.',
        })
        router.refresh()
        setActiveTab('hour-blocks')
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (block: HourBlockWithClient) => {
    if (!block.deleted_at || isPending) {
      return
    }

    setDestroyTarget(block)
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

    const block = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(block.id)

    startTransition(async () => {
      try {
        const result = await destroyHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block permanently deleted',
          description: 'The hour block has been removed.',
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  const handleTabChange = (value: HourBlocksTab) => {
    setActiveTab(value)
  }

  return {
    sheetOpen,
    selectedBlock,
    activeBlocks,
    archivedBlocks,
    sortedClients,
    createDisabled,
    createDisabledReason,
    pendingReason,
    openCreate,
    openEdit,
    handleSheetOpenChange,
    handleComplete,
    activeTab,
    handleTabChange,
    deleteDialog: {
      open: Boolean(deleteTarget),
      target: deleteTarget,
      onCancel: handleCancelDelete,
      onConfirm: handleConfirmDelete,
    },
    destroyDialog: {
      open: Boolean(destroyTarget),
      target: destroyTarget,
      onCancel: handleCancelDestroy,
      onConfirm: handleConfirmDestroy,
    },
    isPending,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    handleRequestDelete,
    handleRestore,
    handleRequestDestroy,
  }
}
