import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  findUserById,
  updateUserProfile,
} from '@/lib/db/settings/users'

import { resolveAvatarUpdate } from '../user-service'
import type { UpdateUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function updatePortalUser(
  input: UpdateUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()

  let existingProfile: { avatar_url: string | null } | undefined

  try {
    existingProfile = await findUserById(input.id)
  } catch (error) {
    console.error('Failed to load user profile for avatar update', error)
    const message =
      error instanceof Error ? error.message : 'Unable to load user profile.'
    return { error: message }
  }

  if (!existingProfile) {
    return { error: 'User not found.' }
  }

  const currentAvatarPath = existingProfile.avatar_url ?? null

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
    await updateUserProfile(input.id, {
      full_name: input.fullName,
      role: input.role,
      deleted_at: null,
      avatar_url: nextAvatarPath,
    })
  } catch (error) {
    console.error('Failed to update user profile', error)
    const message =
      error instanceof Error ? error.message : 'Unable to update user profile.'
    return { error: message }
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
