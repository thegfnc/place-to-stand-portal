'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userCreatedEvent } from '@/lib/activity/events'

import { createPortalUser } from '@/lib/settings/users/services'
import {
  createUserSchema,
  type CreateUserInput,
} from '@/lib/settings/users/user-validation'

import { revalidateUsers } from './helpers'
import type { ActionResult } from './types'

export async function createUser(
  input: CreateUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = createUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Please supply a valid email, full name, and role.' }
  }

  const payload = parsed.data
  const result = await createPortalUser(payload)

  if (!result.error) {
    if (result.userId) {
      const event = userCreatedEvent({
        fullName: payload.fullName,
        role: payload.role,
        email: payload.email,
      })

      await logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'USER',
        targetId: result.userId,
        metadata: event.metadata,
      })
    }

    revalidateUsers()
  }

  return result
}
