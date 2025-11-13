'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userDeletedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'

import { destroyPortalUser } from '@/lib/settings/users/services'
import {
  destroyUserSchema,
  type DestroyUserInput,
} from '@/lib/settings/users/user-validation'
import { getUserById } from '@/lib/queries/users'
import { NotFoundError } from '@/lib/errors/http'

import { revalidateUsersAndRelated } from './helpers'
import type { ActionResult } from './types'

export async function destroyUser(
  input: DestroyUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  return trackSettingsServerInteraction(
    {
      entity: 'user',
      mode: 'destroy',
      targetId: input.id,
      metadata: {
        actorId: actor.id,
      },
    },
    async () => {
      const parsed = destroyUserSchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid permanent delete request.' }
      }

      const payload = parsed.data
      let existingUser: Awaited<ReturnType<typeof getUserById>>

      try {
        existingUser = await getUserById(actor, payload.id)
      } catch (error) {
        console.error('Failed to load user for permanent delete', error)
        if (error instanceof NotFoundError) {
          return { error: 'User not found.' }
        }
        return { error: 'Unable to permanently delete user.' }
      }

      const result = await destroyPortalUser(actor, payload)

      if (!result.error) {
        const event = userDeletedEvent({
          fullName: existingUser.fullName ?? existingUser.email ?? 'User',
          email: existingUser.email ?? undefined,
          role: existingUser.role,
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
