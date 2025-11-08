import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteUserProfile,
  insertUserProfile,
} from '@/lib/db/settings/users'

import {
  cleanupAvatar,
  dispatchPortalInvite,
  finalizeUserAvatar,
  generateTemporaryPassword,
} from '../user-service'
import type { CreateUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function createPortalUser(
  input: CreateUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()
  const temporaryPassword = generateTemporaryPassword()

  const createResult = await adminClient.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
      must_reset_password: true,
    },
  })

  if (createResult.error || !createResult.data.user) {
    console.error('Failed to create auth user', createResult.error)
    return {
      error: createResult.error?.message ?? 'Unable to create Supabase user.',
    }
  }

  const userId = createResult.data.user.id

  let normalizedAvatarPath: string | null = null

  if (input.avatarPath) {
    const avatarResult = await finalizeUserAvatar({
      client: adminClient,
      avatarPath: input.avatarPath,
      userId,
    })

    normalizedAvatarPath = avatarResult.normalizedPath
  }

  try {
    await insertUserProfile({
      id: userId,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      avatar_url: normalizedAvatarPath,
    })
  } catch (error) {
    console.error('Failed to insert user profile', error)
    await adminClient.auth.admin.deleteUser(userId)
    await cleanupAvatar(adminClient, normalizedAvatarPath ?? input.avatarPath)
    const message =
      error instanceof Error ? error.message : 'Unable to create user profile.'
    return { error: message }
  }

  if (normalizedAvatarPath) {
    const existingMetadata = (createResult.data.user.user_metadata ??
      {}) as Record<string, unknown>

    const metadataResult = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMetadata,
        full_name: input.fullName,
        role: input.role,
        must_reset_password: true,
        avatar_url: normalizedAvatarPath,
      },
    })

    if (metadataResult.error) {
      console.error(
        'Failed to sync avatar metadata for new user',
        metadataResult.error
      )
      try {
        await deleteUserProfile(userId)
      } catch (profileCleanupError) {
        console.error(
          'Failed to clean up user profile after metadata sync failure',
          profileCleanupError
        )
      }
      await adminClient.auth.admin.deleteUser(userId)
      await cleanupAvatar(adminClient, normalizedAvatarPath)
      return { error: metadataResult.error.message }
    }
  }

  try {
    await dispatchPortalInvite({
      email: input.email,
      fullName: input.fullName,
      temporaryPassword,
    })
  } catch (error) {
    console.error('Failed to dispatch portal invite', error)
    try {
      await deleteUserProfile(userId)
    } catch (profileCleanupError) {
      console.error('Failed to clean up user profile after invite failure', profileCleanupError)
    }
    await adminClient.auth.admin.deleteUser(userId)
    await cleanupAvatar(adminClient, normalizedAvatarPath)
    return { error: 'Unable to send invite email. Please try again.' }
  }

  return { userId }
}
