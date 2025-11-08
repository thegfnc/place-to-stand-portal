import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { restoreUser } from '@/lib/queries/users'

import type { RestoreUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function restorePortalUser(
  actor: AppUser,
  input: RestoreUserInput
): Promise<UserServiceResult> {
  assertAdmin(actor)

  const adminClient = getSupabaseServiceClient()

  try {
    await restoreUser(actor, input.id)
  } catch (error) {
    console.error('Failed to restore user profile', error)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to restore user profile.',
    }
  }

  const adminUpdate = await adminClient.auth.admin.updateUserById(input.id, {
    user_metadata: {
      deleted_at: null,
    },
  })

  if (adminUpdate.error) {
    console.error('Failed to update auth record', adminUpdate.error)
    return { error: adminUpdate.error.message }
  }

  return {}
}
