'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userArchivedEvent } from '@/lib/activity/events'

import { softDeletePortalUser } from '@/lib/settings/users/services'
import {
  deleteUserSchema,
  type DeleteUserInput,
} from '@/lib/settings/users/user-validation'
import { getUserById } from '@/lib/queries/users'
import { NotFoundError } from '@/lib/errors/http'

import { revalidateUsersAndRelated } from './helpers'
import type { ActionResult } from './types'

export async function softDeleteUser(
  input: DeleteUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = deleteUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const payload = parsed.data
  let existingUser: Awaited<ReturnType<typeof getUserById>>

  try {
    existingUser = await getUserById(actor, payload.id)
  } catch (error) {
    console.error('Failed to load user for archive', error)
    if (error instanceof NotFoundError) {
      return { error: 'User not found.' }
    }
    return { error: 'Unable to archive user.' }
  }

  const result = await softDeletePortalUser(actor, payload)

  if (!result.error) {
    const event = userArchivedEvent({
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
