import { getSupabaseServiceClient } from '@/lib/supabase/service'

import type { RestoreUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function restorePortalUser(
  input: RestoreUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()

  const { error: profileError } = await adminClient
    .from('users')
    .update({ deleted_at: null })
    .eq('id', input.id)

  if (profileError) {
    console.error('Failed to restore user profile', profileError)
    return { error: profileError.message }
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
