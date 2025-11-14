import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import {
  destroyUser,
} from '@/app/(dashboard)/settings/users/actions'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import {
  buildDestroyDialogDescription,
} from '../constants'
import type { DeleteDialogState, UserRow } from '../types'

type UseDestroyUserActionReturn = {
  destroyDialog: DeleteDialogState
  requestDestroy: (user: UserRow) => void
  pendingDestroyId: string | null
  isPending: boolean
}

export function useDestroyUserAction(): UseDestroyUserActionReturn {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [destroyTarget, setDestroyTarget] = useState<UserRow | null>(null)
  const destroyTargetRef = useRef<UserRow | null>(null)
  const [isPending, startTransition] = useTransition()

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
    [isPending],
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
          description: error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      } finally {
        setPendingDestroyId(null)
        destroyTargetRef.current = null
      }
    })
  }, [destroyTarget, isPending, router, startTransition, toast])

  useEffect(() => {
    if (destroyTarget && destroyTargetRef.current !== destroyTarget) {
      destroyTargetRef.current = destroyTarget
    }
  }, [destroyTarget])

  const destroyDialogTarget = destroyTarget ?? destroyTargetRef.current

  const destroyDialog: DeleteDialogState = {
    open: Boolean(destroyTarget),
    description: buildDestroyDialogDescription(destroyDialogTarget),
    confirmDisabled: isPending,
    onCancel: handleCancelDestroy,
    onConfirm: handleConfirmDestroy,
  }

  return {
    destroyDialog,
    requestDestroy: handleRequestDestroy,
    pendingDestroyId,
    isPending,
  }
}

