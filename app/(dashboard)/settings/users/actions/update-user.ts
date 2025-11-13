'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userUpdatedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { getUserById } from '@/lib/queries/users'
import { NotFoundError } from '@/lib/errors/http'

import { updatePortalUser } from '@/lib/settings/users/services'
import {
  updateUserSchema,
  type UpdateUserInput,
} from '@/lib/settings/users/user-validation'

import { revalidateUsers } from './helpers'
import type { ActionResult } from './types'

export async function updateUser(
  input: UpdateUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  return trackSettingsServerInteraction(
    {
      entity: 'user',
      mode: 'edit',
      targetId: input.id,
      metadata: {
        actorId: actor.id,
      },
    },
    async () => {
      const parsed = updateUserSchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid user update payload.' }
      }

      const payload = parsed.data
      let existingUser: Awaited<ReturnType<typeof getUserById>>

      try {
        existingUser = await getUserById(actor, payload.id)
      } catch (error) {
        console.error('Failed to load user for update', error)
        if (error instanceof NotFoundError) {
          return { error: 'User not found.' }
        }
        return { error: 'Unable to update user.' }
      }

      const result = await updatePortalUser(actor, payload)

      if (!result.error) {
        let updatedUser: Awaited<ReturnType<typeof getUserById>> | null = null

        try {
          updatedUser = await getUserById(actor, payload.id)
        } catch (error) {
          console.error('Failed to reload user after update', error)
        }

        const resolvedFullName =
          updatedUser?.fullName ??
          payload.fullName ??
          existingUser.fullName ??
          null
        const resolvedRole =
          updatedUser?.role ?? payload.role ?? existingUser.role
        const resolvedAvatar =
          updatedUser?.avatarUrl ?? existingUser.avatarUrl ?? null

        const changedFields: string[] = []
        const previousDetails: Record<string, unknown> = {}
        const nextDetails: Record<string, unknown> = {}

        if (existingUser.fullName !== resolvedFullName) {
          changedFields.push('name')
          previousDetails.fullName = existingUser.fullName
          nextDetails.fullName = resolvedFullName
        }

        if (existingUser.role !== resolvedRole) {
          changedFields.push('role')
          previousDetails.role = existingUser.role
          nextDetails.role = resolvedRole
        }

        const previousAvatar = existingUser.avatarUrl ?? null
        const nextAvatar = resolvedAvatar

        if (previousAvatar !== nextAvatar) {
          changedFields.push('avatar')
          previousDetails.avatarUrl = previousAvatar
          nextDetails.avatarUrl = nextAvatar
        }

        if (payload.password) {
          changedFields.push('password')
        }

        if (changedFields.length > 0) {
          const eventFullName =
            resolvedFullName ?? existingUser.email ?? 'User'

          const detailsPayload =
            Object.keys(previousDetails).length > 0 ||
            Object.keys(nextDetails).length > 0
              ? { before: previousDetails, after: nextDetails }
              : undefined

          const event = userUpdatedEvent({
            fullName: eventFullName,
            changedFields,
            details: detailsPayload,
            passwordChanged: Boolean(payload.password),
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
        }

        revalidateUsers()
      }

      return result
    }
  )
}
