import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'

import {
  destroyUser,
  restoreUser,
  softDeleteUser,
} from '@/app/(dashboard)/settings/users/actions'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import {
  SELF_DELETE_REASON,
  buildDeleteDialogDescription,
  buildDestroyDialogDescription,
} from './constants'
import type { DeleteDialogState, UserAssignments, UserRow } from './types'

export type UserMutationState = {
  deleteDialog: DeleteDialogState
  destroyDialog: DeleteDialogState
  requestDelete: (user: UserRow) => void
  requestDestroy: (user: UserRow) => void
  restore: (user: UserRow) => void
  isPending: boolean
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  selfDeleteReason: string
}

type UseUserMutationStateArgs = {
  currentUserId: string
  assignments: UserAssignments
}

export const useUserMutationState = ({
  currentUserId,
  assignments,
}: UseUserMutationStateArgs): UserMutationState => {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const deleteTargetRef = useRef<UserRow | null>(null)
  const [destroyTarget, setDestroyTarget] = useState<UserRow | null>(null)
  const destroyTargetRef = useRef<UserRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const notifySelfDeleteBlocked = useCallback(() => {
    toast({
      title: 'Cannot delete your own account',
      description:
        'Switch to another administrator before removing your access.',
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
    [currentUserId, isPending, notifySelfDeleteBlocked]
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
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      } finally {
        setPendingDeleteId(null)
        deleteTargetRef.current = null
      }
    })
  }, [
    currentUserId,
    deleteTarget,
    isPending,
    notifySelfDeleteBlocked,
    router,
    startTransition,
    toast,
  ])

  const handleCancelDestroy = useCallback(() => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
    destroyTargetRef.current = null
  }, [isPending])

  const handleRequestDestroy = useCallback(
    (user: UserRow) => {
      if (!user.deleted_at || isPending) {
        return
      }

      setDestroyTarget(user)
    },
    [isPending]
  )

  const handleConfirmDestroy = useCallback(() => {
    if (isPending) {
      return
    }

    const target = destroyTarget ?? destroyTargetRef.current

    if (!target) {
      return
    }

    if (!target.deleted_at) {
      setDestroyTarget(null)
      destroyTargetRef.current = null
      return
    }

    setDestroyTarget(null)
    setPendingDestroyId(target.id)

    startTransition(async () => {
      const interaction = startSettingsInteraction({
        entity: 'user',
        mode: 'destroy',
        targetId: target.id,
        metadata: {
          email: target.email,
          role: target.role,
        },
      })

      try {
        const result = await destroyUser({ id: target.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: target.id,
            error: result.error,
          })
          toast({
            title: 'Unable to permanently delete user',
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
          title: 'User permanently deleted',
          description: `${target.full_name ?? target.email} has been removed from the portal.`,
        })
        router.refresh()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: target.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        toast({
          title: 'Unable to permanently delete user',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      } finally {
        setPendingDestroyId(null)
        destroyTargetRef.current = null
      }
    })
  }, [destroyTarget, isPending, router, startTransition, toast])

  const handleRestore = useCallback(
    (user: UserRow) => {
      if (!user.deleted_at) {
        return
      }

      setPendingRestoreId(user.id)
      startTransition(async () => {
        const interaction = startSettingsInteraction({
          entity: 'user',
          mode: 'restore',
          targetId: user.id,
          metadata: {
            email: user.email,
            role: user.role,
          },
        })

        try {
          const result = await restoreUser({ id: user.id })

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              targetId: user.id,
              error: result.error,
            })
            toast({
              title: 'Unable to restore user',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: user.id,
          })

          toast({
            title: 'User restored',
            description: `${user.full_name ?? user.email} can access the portal again.`,
          })
          router.refresh()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          toast({
            title: 'Unable to restore user',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
          })
        } finally {
          setPendingRestoreId(null)
        }
      })
    },
    [router, startTransition, toast]
  )

  useEffect(() => {
    if (deleteTarget && deleteTargetRef.current !== deleteTarget) {
      deleteTargetRef.current = deleteTarget
    }
  }, [deleteTarget])

  useEffect(() => {
    if (destroyTarget && destroyTargetRef.current !== destroyTarget) {
      destroyTargetRef.current = destroyTarget
    }
  }, [destroyTarget])

  const dialogTarget = deleteTarget ?? deleteTargetRef.current
  const destroyDialogTarget = destroyTarget ?? destroyTargetRef.current

  const deleteDialog: DeleteDialogState = {
    open: Boolean(deleteTarget),
    description: buildDeleteDialogDescription(dialogTarget, assignments),
    confirmDisabled: isPending,
    onCancel: handleCancelDelete,
    onConfirm: handleConfirmDelete,
  }

  const destroyDialog: DeleteDialogState = {
    open: Boolean(destroyTarget),
    description: buildDestroyDialogDescription(destroyDialogTarget),
    confirmDisabled: isPending,
    onCancel: handleCancelDestroy,
    onConfirm: handleConfirmDestroy,
  }

  return {
    deleteDialog,
    destroyDialog,
    requestDelete: handleRequestDelete,
    requestDestroy: handleRequestDestroy,
    restore: handleRestore,
    isPending,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    selfDeleteReason: SELF_DELETE_REASON,
  }
}
