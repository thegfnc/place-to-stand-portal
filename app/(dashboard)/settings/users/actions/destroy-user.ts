'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userDeletedEvent } from '@/lib/activity/events'

import { destroyPortalUser } from '@/lib/settings/users/services'
import {
  destroyUserSchema,
  type DestroyUserInput,
} from '@/lib/settings/users/user-validation'

import { revalidateUsersAndRelated } from './helpers'
import { fetchUserById, getSupabase } from './user-queries'
import type { ActionResult } from './types'

type UserSummary = {
  id: string
  email: string | null
  full_name: string | null
  role: string
}

export async function destroyUser(
  input: DestroyUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = destroyUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid permanent delete request.' }
  }

  const payload = parsed.data
  const supabase = getSupabase()

  const {
    data: existingUser,
    error: existingUserError,
  } = await fetchUserById<UserSummary>(
    supabase,
    payload.id,
    `id, email, full_name, role`
  )

  if (existingUserError) {
    console.error('Failed to load user for permanent delete', existingUserError)
    return { error: 'Unable to permanently delete user.' }
  }

  if (!existingUser) {
    return { error: 'User not found.' }
  }

  const result = await destroyPortalUser(payload)

  if (!result.error) {
    const event = userDeletedEvent({
      fullName: existingUser.full_name ?? existingUser.email ?? 'User',
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
