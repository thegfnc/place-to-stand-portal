import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import { setUserDisabled } from '@/app/(dashboard)/settings/users/actions'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import { buildDisableDialogDescription } from '../constants'
import type { DeleteDialogState, UserRow } from '../types'

type UseSetUserDisabledActionReturn = {
  /**
   * Enabling applies immediately; disabling opens `disableDialog` first,
   * because the list defaults to the Enabled filter and the row vanishes
   * on success — a stray click on the switch must not be a surprise.
   */
  setDisabled: (user: UserRow, disabled: boolean) => void
  disableDialog: DeleteDialogState
  pendingDisableId: string | null
  isPending: boolean
}

export function useSetUserDisabledAction(): UseSetUserDisabledActionReturn {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingDisableId, setPendingDisableId] = useState<string | null>(null)
  const [disableTarget, setDisableTarget] = useState<UserRow | null>(null)
  // Retains the last target so the dialog copy stays stable while the close
  // animation plays after disableTarget is cleared (same as the archive dialog).
  const [lastDisableTarget, setLastDisableTarget] = useState<UserRow | null>(null)
  const [isPending, startTransition] = useTransition()

  if (disableTarget && lastDisableTarget !== disableTarget) {
    setLastDisableTarget(disableTarget)
  }

  const runSetDisabled = useCallback(
    (user: UserRow, disabled: boolean) => {
      setPendingDisableId(user.id)
      startTransition(async () => {
        const interaction = startSettingsInteraction({
          entity: 'user',
          mode: 'edit',
          targetId: user.id,
          metadata: {
            email: user.email,
            role: user.role,
            disabled,
          },
        })

        try {
          const result = await setUserDisabled({ id: user.id, disabled })

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              targetId: user.id,
              error: result.error,
            })
            toast({
              title: 'Unable to update access',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: user.id,
          })

          const displayName = user.full_name ?? user.email
          toast({
            title: disabled ? 'Access disabled' : 'Access enabled',
            description: disabled
              ? `${displayName} can no longer sign in to the portal.`
              : `${displayName} can sign in to the portal again.`,
          })
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          toast({
            title: 'Unable to update access',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
          })
        } finally {
          setPendingDisableId(null)
          // Always refresh, on success, structured error, AND throw: the
          // service is fail-closed and mutates the DB flag before activity
          // logging/telemetry, so any settle state may have changed the row.
          // A filtered access list must never show a row that contradicts
          // the persisted state; refreshing after a no-op failure is
          // harmless.
          router.refresh()
        }
      })
    },
    [router, startTransition, toast],
  )

  const handleSetDisabled = useCallback(
    (user: UserRow, disabled: boolean) => {
      if (isPending) {
        return
      }
      if (!disabled) {
        runSetDisabled(user, false)
        return
      }
      setDisableTarget(user)
    },
    [isPending, runSetDisabled],
  )

  const handleCancelDisable = useCallback(() => {
    if (isPending) {
      return
    }
    setDisableTarget(null)
    setLastDisableTarget(null)
  }, [isPending])

  const handleConfirmDisable = useCallback(() => {
    if (isPending) {
      return
    }
    const target = disableTarget ?? lastDisableTarget
    if (!target) {
      return
    }
    setDisableTarget(null)
    setLastDisableTarget(null)
    runSetDisabled(target, true)
  }, [disableTarget, isPending, lastDisableTarget, runSetDisabled])

  const disableDialog: DeleteDialogState = {
    open: Boolean(disableTarget),
    description: buildDisableDialogDescription(
      disableTarget ?? lastDisableTarget,
    ),
    confirmDisabled: isPending,
    onCancel: handleCancelDisable,
    onConfirm: handleConfirmDisable,
  }

  return {
    setDisabled: handleSetDisabled,
    disableDialog,
    pendingDisableId,
    isPending,
  }
}
