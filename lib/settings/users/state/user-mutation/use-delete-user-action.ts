import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import {
  softDeleteUser,
} from '@/app/(dashboard)/settings/users/actions'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import {
  buildDeleteDialogDescription,
  SELF_DELETE_REASON,
} from '../constants'
import type {
  DeleteDialogState,
  UserAssignments,
  UserRow,
} from '../types'

type UseDeleteUserActionArgs = {
  currentUserId: string
  assignments: UserAssignments
}

type UseDeleteUserActionReturn = {
  deleteDialog: DeleteDialogState
  requestDelete: (user: UserRow) => void
  pendingDeleteId: string | null
  isPending: boolean
  notifySelfDeleteReason: string
}

export function useDeleteUserAction({
  currentUserId,
  assignments,
}: UseDeleteUserActionArgs): UseDeleteUserActionReturn {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const deleteTargetRef = useRef<UserRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const notifySelfDeleteBlocked = useCallback(() => {
    toast({
      title: 'Cannot archive your own account',
      description: 'Switch to another administrator before removing your access.',
      variant: 'destructive',
    })
  }, [toast])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
    deleteTargetRef.current = null
  }, [isPending])

  const handleRequestDelete = useCallback(
    (user: UserRow) => {
      if (user.id === currentUserId) {
        notifySelfDeleteBlocked()
        return
      }

      if (user.deleted_at || isPending) {
        return
      }

      setDeleteTarget(user)
    },
    [currentUserId, isPending, notifySelfDeleteBlocked],
  )

  const handleConfirmDelete = useCallback(() => {
    if (isPending) {
      return
    }

    const target = deleteTarget ?? deleteTargetRef.current

    if (!target) {
      return
    }

    if (target.id === currentUserId) {
      notifySelfDeleteBlocked()
      setDeleteTarget(null)
      deleteTargetRef.current = null
      return
    }

    if (target.deleted_at) {
      setDeleteTarget(null)
      deleteTargetRef.current = null
      return
    }

    setDeleteTarget(null)
    setPendingDeleteId(target.id)

    startTransition(async () => {
      const interaction = startSettingsInteraction({
        entity: 'user',
        mode: 'delete',
        targetId: target.id,
        metadata: {
          email: target.email,
          role: target.role,
        },
      })

      try {
        const result = await softDeleteUser({ id: target.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: target.id,
            error: result.error,
          })
          toast({
            title: 'Unable to delete user',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: target.id,
        })

        toast({
          title: 'User deleted',
          description: `${target.full_name ?? target.email} can no longer access the portal.`,
        })
        router.refresh()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: target.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        toast({
          title: 'Unable to delete user',
          description: error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      } finally {
        setPendingDeleteId(null)
        deleteTargetRef.current = null
      }
    })
  }, [currentUserId, deleteTarget, isPending, notifySelfDeleteBlocked, router, startTransition, toast])

  useEffect(() => {
    if (deleteTarget && deleteTargetRef.current !== deleteTarget) {
      deleteTargetRef.current = deleteTarget
    }
  }, [deleteTarget])

  const dialogTarget = deleteTarget ?? deleteTargetRef.current

  const deleteDialog: DeleteDialogState = {
    open: Boolean(deleteTarget),
    description: buildDeleteDialogDescription(dialogTarget, assignments),
    confirmDisabled: isPending,
    onCancel: handleCancelDelete,
    onConfirm: handleConfirmDelete,
  }

  return {
    deleteDialog,
    requestDelete: handleRequestDelete,
    pendingDeleteId,
    isPending,
    notifySelfDeleteReason: SELF_DELETE_REASON,
  }
}

