import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import {
  restoreUser,
} from '@/app/(dashboard)/settings/users/actions'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import type { UserRow } from '../types'

type UseRestoreUserActionReturn = {
  restore: (user: UserRow) => void
  pendingRestoreId: string | null
  isPending: boolean
}

export function useRestoreUserAction(): UseRestoreUserActionReturn {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
            description: error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
          })
        } finally {
          setPendingRestoreId(null)
        }
      })
    },
    [router, startTransition, toast],
  )

  return {
    restore: handleRestore,
    pendingRestoreId,
    isPending,
  }
}

