import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getUserById } from '@/lib/queries/users'

import { resolveAvatarUpdate } from '../user-service'
import type { UpdateUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function updatePortalUser(
  actor: AppUser,
  input: UpdateUserInput
): Promise<UserServiceResult> {
  assertAdmin(actor)

  const adminClient = getSupabaseServiceClient()

  let existingAvatarPath: string | null = null

  try {
    const existingProfile = await getUserById(actor, input.id)
    existingAvatarPath = existingProfile.avatarUrl ?? null
  } catch (error) {
    console.error('Failed to load user profile for avatar update', error)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to update user profile.',
    }
  }

  const currentAvatarPath = existingAvatarPath

  const avatarResolution = await resolveAvatarUpdate({
    client: adminClient,
    userId: input.id,
    currentAvatarPath,
    incomingAvatarPath: input.avatarPath,
    removeRequested: input.avatarRemoved,
  })

  if (avatarResolution.error) {
    return { error: avatarResolution.error }
  }

  const nextAvatarPath = avatarResolution.nextAvatarPath

  try {
    await db
      .update(users)
      .set({
        fullName: input.fullName,
        role: input.role,
        deletedAt: null,
        avatarUrl: nextAvatarPath,
      })
      .where(eq(users.id, input.id))
  } catch (error) {
    console.error('Failed to update user profile', error)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to update user profile.',
    }
  }

  const authLookup = await adminClient.auth.admin.getUserById(input.id)

  if (authLookup.error || !authLookup.data?.user) {
    console.error('Failed to load auth user for update', authLookup.error)
    return {
      error: authLookup.error?.message ?? 'Unable to load Supabase user.',
    }
  }

  const currentMetadata = (authLookup.data.user.user_metadata ?? {}) as Record<
    string,
    unknown
  >

  const nextMetadata: Record<string, unknown> = {
    ...currentMetadata,
    full_name: input.fullName,
    role: input.role,
    deleted_at: null,
    avatar_url: nextAvatarPath,
  }

  if (input.password) {
    nextMetadata.must_reset_password = true
  }

  const updatePayload: Parameters<
    typeof adminClient.auth.admin.updateUserById
  >[1] = {
    user_metadata: nextMetadata,
  }

  if (input.password) {
    updatePayload.password = input.password
  }

  const authUpdate = await adminClient.auth.admin.updateUserById(
    input.id,
    updatePayload
  )

  if (authUpdate.error) {
    console.error('Failed to sync auth metadata', authUpdate.error)
    return { error: authUpdate.error.message }
  }

  return {}
}
