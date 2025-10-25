import { randomBytes } from 'node:crypto'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteAvatarObject,
  ensureAvatarBucket,
  moveAvatarToUserFolder,
} from '@/lib/storage/avatar'
import { sendPortalInviteEmail } from '@/lib/email/send-portal-invite'

export type AvatarFinalizationResult = {
  normalizedPath: string | null
}

export function generateTemporaryPassword() {
  return randomBytes(18).toString('base64url').slice(0, 18)
}

export const userAdminClient = getSupabaseServiceClient

export async function finalizeUserAvatar(options: {
  client: ReturnType<typeof getSupabaseServiceClient>
  avatarPath?: string | null
  userId: string
}): Promise<AvatarFinalizationResult> {
  const { client, avatarPath, userId } = options

  if (!avatarPath) {
    return { normalizedPath: null }
  }

  try {
    await ensureAvatarBucket(client)
    const normalizedPath = await moveAvatarToUserFolder({
      client,
      path: avatarPath,
      userId,
    })
    return { normalizedPath }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to finalize avatar for user', error)
    }

    try {
      await deleteAvatarObject({ client, path: avatarPath })
    } catch (cleanupError) {
      console.error('Failed to clean up pending avatar', cleanupError)
    }

    return { normalizedPath: null }
  }
}

export async function cleanupAvatar(
  client: ReturnType<typeof getSupabaseServiceClient>,
  path: string | null | undefined
) {
  if (!path) {
    return
  }

  try {
    await deleteAvatarObject({ client, path })
  } catch (cleanupError) {
    console.error('Failed to clean up avatar asset', cleanupError)
  }
}

export async function dispatchPortalInvite(options: {
  email: string
  fullName: string
  temporaryPassword: string
}) {
  const { email, fullName, temporaryPassword } = options
  await sendPortalInviteEmail({ to: email, fullName, temporaryPassword })
}

export async function resolveAvatarUpdate(options: {
  client: ReturnType<typeof getSupabaseServiceClient>
  userId: string
  currentAvatarPath: string | null
  incomingAvatarPath?: string | null
  removeRequested?: boolean
}): Promise<{ nextAvatarPath: string | null; error?: string }> {
  const {
    client,
    userId,
    currentAvatarPath,
    incomingAvatarPath,
    removeRequested,
  } = options

  if (removeRequested) {
    if (currentAvatarPath) {
      try {
        await deleteAvatarObject({ client, path: currentAvatarPath })
      } catch (error) {
        console.error('Failed to delete existing avatar', error)
        return {
          nextAvatarPath: currentAvatarPath,
          error: 'Unable to remove current avatar.',
        }
      }
    }

    return { nextAvatarPath: null }
  }

  if (!incomingAvatarPath || incomingAvatarPath === currentAvatarPath) {
    return { nextAvatarPath: currentAvatarPath }
  }

  try {
    await ensureAvatarBucket(client)
    const movedPath = await moveAvatarToUserFolder({
      client,
      path: incomingAvatarPath,
      userId,
    })

    if (currentAvatarPath && currentAvatarPath !== movedPath) {
      try {
        await deleteAvatarObject({ client, path: currentAvatarPath })
      } catch (error) {
        console.error('Failed to delete previous avatar', error)
      }
    }

    return { nextAvatarPath: movedPath ?? null }
  } catch (error) {
    console.error('Failed to process avatar update', error)

    try {
      await deleteAvatarObject({ client, path: incomingAvatarPath })
    } catch (cleanupError) {
      console.error(
        'Failed to clean up pending avatar after update error',
        cleanupError
      )
    }

    return {
      nextAvatarPath: currentAvatarPath,
      error: 'Unable to update avatar.',
    }
  }
}
