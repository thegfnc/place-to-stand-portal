import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { updateUserProfile } from '@/lib/db/settings/users'

import type { RestoreUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function restorePortalUser(
  input: RestoreUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()

  try {
    await updateUserProfile(input.id, { deleted_at: null })
  } catch (error) {
    console.error('Failed to restore user profile', error)
    const message =
      error instanceof Error ? error.message : 'Unable to restore user profile.'
    return { error: message }
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
