import { getSupabaseServiceClient } from '@/lib/supabase/service'

import type { DeleteUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function softDeletePortalUser(
  input: DeleteUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()
  const deletionTimestamp = new Date().toISOString()

  const { error: profileError } = await adminClient
    .from('users')
    .update({ deleted_at: deletionTimestamp })
    .eq('id', input.id)

  if (profileError) {
    console.error('Failed to soft delete user profile', profileError)
    return { error: profileError.message }
  }

  const associationUpdates = [
    {
      context: 'client assignments',
      promise: adminClient
        .from('client_members')
        .update({ deleted_at: deletionTimestamp })
        .eq('user_id', input.id)
        .is('deleted_at', null),
    },
    {
      context: 'task assignments',
      promise: adminClient
        .from('task_assignees')
        .update({ deleted_at: deletionTimestamp })
        .eq('user_id', input.id)
        .is('deleted_at', null),
    },
  ] as const

  for (const { promise, context } of associationUpdates) {
    const { error } = await promise
    if (error) {
      console.error(`Failed to remove user ${context}`, error)
      return { error: `Unable to remove user ${context}.` }
    }
  }

  const adminUpdate = await adminClient.auth.admin.updateUserById(input.id, {
    user_metadata: {
      deleted_at: deletionTimestamp,
    },
  })

  if (adminUpdate.error) {
    console.error('Failed to update auth record', adminUpdate.error)
    return { error: adminUpdate.error.message }
  }

  return {}
}
