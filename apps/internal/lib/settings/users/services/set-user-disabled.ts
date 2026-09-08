import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { revokeUserOauthConnections } from '@/lib/oauth/revoke-user-connections'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import type { SetUserDisabledInput } from '../user-validation'
import type { UserServiceResult } from '../types'

// Supabase has no permanent-ban flag; a far-future ban_duration is the
// supported way to make auth reject sign-in attempts (password + magic link).
const DISABLED_BAN_DURATION = '87600h' // ~10 years
const CLEAR_BAN_DURATION = 'none'

export async function setPortalUserDisabled(
  actor: AppUser,
  input: SetUserDisabledInput
): Promise<UserServiceResult> {
  assertAdmin(actor)

  if (actor.id === input.id) {
    return { error: 'You cannot disable your own account.' }
  }

  const adminClient = getSupabaseServiceClient()

  // Ordering keeps a partial failure fail-closed in both directions: when
  // disabling, the DB flag lands first (sessions die even if the ban call
  // fails); when enabling, the ban clears first (the DB flag still blocks
  // access if the second step fails).
  if (input.disabled) {
    const flagError = await setDisabledFlag(input.id, new Date().toISOString())
    if (flagError) {
      return { error: flagError }
    }

    const banError = await setAuthBan(adminClient, input.id, DISABLED_BAN_DURATION)
    if (banError) {
      return { error: banError }
    }

    // Offboarding ends the portal's hold on the member's provider
    // credentials too. Re-enabling requires reconnecting each account.
    try {
      await revokeUserOauthConnections(input.id)
    } catch (error) {
      console.error('Failed to revoke provider connections for disabled user', error)
      return { error: 'User disabled, but provider connections could not be revoked.' }
    }

    return {}
  }

  const banError = await setAuthBan(adminClient, input.id, CLEAR_BAN_DURATION)
  if (banError) {
    return { error: banError }
  }

  const flagError = await setDisabledFlag(input.id, null)
  if (flagError) {
    return { error: flagError }
  }

  return {}
}

async function setDisabledFlag(
  userId: string,
  disabledAt: string | null
): Promise<string | null> {
  try {
    await db.update(users).set({ disabledAt }).where(eq(users.id, userId))
    return null
  } catch (error) {
    console.error('Failed to update user disabled flag', error)
    return 'Unable to update user access.'
  }
}

async function setAuthBan(
  adminClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  banDuration: string
): Promise<string | null> {
  const result = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  })

  if (result.error) {
    console.error('Failed to sync Supabase auth ban', result.error)
    return banDuration === CLEAR_BAN_DURATION
      ? 'Unable to re-enable sign-in for this user.'
      : 'Access disabled, but blocking sign-in attempts failed. Toggle again to retry.'
  }

  return null
}
