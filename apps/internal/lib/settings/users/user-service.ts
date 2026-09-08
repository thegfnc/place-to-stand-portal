import { randomBytes } from 'node:crypto'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteAvatarObject,
  ensureAvatarBucket,
  moveAvatarToUserFolder,
} from '@/lib/storage/avatar'
import {
  sendAdminInviteEmail,
  sendPortalInviteEmail,
} from '@/lib/email/send-portal-invite'
import { serverEnv } from '@/lib/env.server'

export type AvatarFinalizationResult = {
  normalizedPath: string | null
}

export function generateTemporaryPassword() {
  return randomBytes(18).toString('base64url').slice(0, 18)
}

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

/**
 * Client portal invite: generate a one-time sign-in link and mail it.
 *
 * Uses the admin `generateLink` API rather than `signInWithOtp`, which keeps
 * delivery on Resend (our branding, our logs) and avoids consuming the
 * per-hour `email_sent` rate limit that gates the self-serve sign-in page.
 *
 * `type: 'magiclink'` and not `'invite'` — the auth user already exists by the
 * time this runs, and `'invite'` is for creating one.
 *
 * Throws on failure so callers can roll back; both call sites already treat a
 * failed invite as a failed operation.
 */
export async function dispatchPortalInvite(options: {
  email: string
  fullName: string
}) {
  const { email, fullName } = options

  const { data, error } = await getSupabaseServiceClient().auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const tokenHash = data?.properties?.hashed_token

  if (error || !tokenHash) {
    console.error('Failed to generate portal invite link', error)
    throw error ?? new Error('Supabase returned no verification token')
  }

  // Deliberately NOT `properties.action_link`.
  //
  // That link points at Supabase's /auth/v1/verify, which completes the implicit
  // flow and hands the session back in the URL *fragment*
  // (#access_token=...). Fragments are never sent to the server, so a route
  // handler sees no credentials at all and bounces the user to /sign-in. PKCE is
  // not an option either: an admin-generated link has no browser-side code
  // verifier to pair with.
  //
  // Pointing at our own /auth/confirm instead lets `verifyOtp` run server-side,
  // where it can actually set the session cookie. It also takes the invite off
  // Supabase's redirect allowlist entirely, since the URL is ours.
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: 'magiclink',
    redirect_to: '/onboarding',
  })
  const actionLink = `${serverEnv.CLIENT_PORTAL_URL}/auth/confirm?${params}`

  await sendPortalInviteEmail({ to: email, fullName, actionLink })
}

/**
 * Internal admin invite: unchanged temp-password flow.
 *
 * `baseUrl` must be the internal app. Passing the client portal here is the bug
 * this split exists to prevent — admins sign in at a different origin.
 */
export async function dispatchAdminInvite(options: {
  email: string
  fullName: string
  temporaryPassword: string
  baseUrl: string
}) {
  const { email, fullName, temporaryPassword, baseUrl } = options
  await sendAdminInviteEmail({ to: email, fullName, temporaryPassword, baseUrl })
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
