'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userRestoredEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'

import { restorePortalUser } from '@/lib/settings/users/services'
import {
  restoreUserSchema,
  type RestoreUserInput,
} from '@/lib/settings/users/user-validation'
import { getUserById } from '@/lib/queries/users'
import { NotFoundError } from '@/lib/errors/http'

import { revalidateUsersAndRelated } from './helpers'
import type { ActionResult } from './types'

export async function restoreUser(
  input: RestoreUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  return trackSettingsServerInteraction(
    {
      entity: 'user',
      mode: 'restore',
      targetId: input.id,
      metadata: {
        actorId: actor.id,
      },
    },
    async () => {
      const parsed = restoreUserSchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid restore request.' }
      }

      const payload = parsed.data
      let existingUser: Awaited<ReturnType<typeof getUserById>>

      try {
        existingUser = await getUserById(actor, payload.id)
      } catch (error) {
        console.error('Failed to load user for restore', error)
        if (error instanceof NotFoundError) {
          return { error: 'User not found.' }
        }
        return { error: 'Unable to restore user.' }
      }

      const result = await restorePortalUser(actor, payload)

      if (!result.error) {
        let resolvedUser: Awaited<ReturnType<typeof getUserById>> | null = null

        try {
          resolvedUser = await getUserById(actor, payload.id)
        } catch (error) {
          console.error('Failed to reload user after restore', error)
        }

        const finalUser = resolvedUser ?? existingUser
        const event = userRestoredEvent({
          fullName: finalUser.fullName ?? finalUser.email ?? 'User',
          email: finalUser.email ?? undefined,
          role: finalUser.role,
        })

        await logActivity({
          actorId: actor.id,
          actorRole: actor.role,
          verb: event.verb,
          summary: event.summary,
          targetType: 'USER',
          targetId: payload.id,
          metadata: event.metadata,
        })

        revalidateUsersAndRelated()
      }

      return result
    }
  )
}
