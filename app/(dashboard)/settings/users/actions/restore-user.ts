'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userRestoredEvent } from '@/lib/activity/events'

import { restorePortalUser } from '@/lib/settings/users/services'
import {
  restoreUserSchema,
  type RestoreUserInput,
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

export async function restoreUser(
  input: RestoreUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = restoreUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
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
    console.error('Failed to load user for restore', existingUserError)
    return { error: 'Unable to restore user.' }
  }

  if (!existingUser) {
    return { error: 'User not found.' }
  }

  const result = await restorePortalUser(payload)

  if (!result.error) {
    const {
      data: restoredUser,
      error: restoredUserError,
    } = await fetchUserById<UserSummary>(
      supabase,
      payload.id,
      `email, full_name, role`
    )

    if (restoredUserError) {
      console.error('Failed to reload user after restore', restoredUserError)
    }

    const resolvedUser = restoredUser ?? existingUser
    const event = userRestoredEvent({
      fullName: resolvedUser.full_name ?? resolvedUser.email ?? 'User',
      email: resolvedUser.email ?? undefined,
      role: resolvedUser.role,
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
