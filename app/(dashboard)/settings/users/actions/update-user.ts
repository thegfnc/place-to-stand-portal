'use server'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { userUpdatedEvent } from '@/lib/activity/events'

import { updatePortalUser } from '@/lib/settings/users/services'
import {
  updateUserSchema,
  type UpdateUserInput,
} from '@/lib/settings/users/user-validation'

import { revalidateUsers } from './helpers'
import { fetchUserById, getSupabase } from './user-queries'
import type { ActionResult } from './types'

type ExistingUserRecord = {
  id: string
  email: string | null
  full_name: string | null
  role: string
  avatar_url: string | null
}

type UpdatedUserRecord = {
  full_name: string | null
  role: string
  avatar_url: string | null
}

export async function updateUser(
  input: UpdateUserInput
): Promise<ActionResult> {
  const actor = await requireRole('ADMIN')

  const parsed = updateUserSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid user update payload.' }
  }

  const payload = parsed.data
  const supabase = getSupabase()

  const {
    data: existingUser,
    error: existingUserError,
  } = await fetchUserById<ExistingUserRecord>(
    supabase,
    payload.id,
    `id, email, full_name, role, avatar_url`
  )

  if (existingUserError) {
    console.error('Failed to load user for update', existingUserError)
    return { error: 'Unable to update user.' }
  }

  if (!existingUser) {
    return { error: 'User not found.' }
  }

  const result = await updatePortalUser(payload)

  if (!result.error) {
    const {
      data: updatedUser,
      error: updatedUserError,
    } = await fetchUserById<UpdatedUserRecord>(
      supabase,
      payload.id,
      `full_name, role, avatar_url`
    )

    if (updatedUserError) {
      console.error('Failed to reload user after update', updatedUserError)
    }

    const resolvedFullName =
      updatedUser?.full_name ?? payload.fullName ?? existingUser.full_name
    const resolvedRole = updatedUser?.role ?? payload.role ?? existingUser.role
    const resolvedAvatar =
      updatedUser?.avatar_url ?? existingUser.avatar_url ?? null

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingUser.full_name !== resolvedFullName) {
      changedFields.push('name')
      previousDetails.fullName = existingUser.full_name
      nextDetails.fullName = resolvedFullName
    }

    if (existingUser.role !== resolvedRole) {
      changedFields.push('role')
      previousDetails.role = existingUser.role
      nextDetails.role = resolvedRole
    }

    const previousAvatar = existingUser.avatar_url ?? null
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
      const detailsPayload =
        Object.keys(previousDetails).length > 0 ||
        Object.keys(nextDetails).length > 0
          ? { before: previousDetails, after: nextDetails }
          : undefined

      const event = userUpdatedEvent({
        fullName: resolvedFullName,
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
