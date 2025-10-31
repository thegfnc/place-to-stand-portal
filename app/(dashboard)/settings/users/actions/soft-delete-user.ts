'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userArchivedEvent } from '@/lib/activity/events'

import { softDeletePortalUser } from '@/lib/settings/users/services'
import {
  deleteUserSchema,
  type DeleteUserInput,
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

export async function softDeleteUser(
  input: DeleteUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = deleteUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const payload = parsed.data
  const supabase = getSupabase()

  const { data: existingUser, error: existingUserError } =
    await fetchUserById<UserSummary>(
      supabase,
      payload.id,
      `id, email, full_name, role`
    )

  if (existingUserError) {
    console.error('Failed to load user for archive', existingUserError)
    return { error: 'Unable to archive user.' }
  }

  if (!existingUser) {
    return { error: 'User not found.' }
  }

  const result = await softDeletePortalUser(payload)

  if (!result.error) {
    const event = userArchivedEvent({
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
