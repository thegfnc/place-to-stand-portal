import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  archiveClientMemberships,
  archiveTaskAssignments,
  updateUserProfile,
} from '@/lib/db/settings/users'

import type { DeleteUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function softDeletePortalUser(
  input: DeleteUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()
  const deletionTimestamp = new Date().toISOString()

  try {
    await updateUserProfile(input.id, { deleted_at: deletionTimestamp })
  } catch (error) {
    console.error('Failed to soft delete user profile', error)
    const message =
      error instanceof Error ? error.message : 'Unable to delete user profile.'
    return { error: message }
  }

  try {
    await archiveClientMemberships(input.id, deletionTimestamp)
  } catch (error) {
    console.error('Failed to remove user client assignments', error)
    return { error: 'Unable to remove user client assignments.' }
  }

  try {
    await archiveTaskAssignments(input.id, deletionTimestamp)
  } catch (error) {
    console.error('Failed to remove user task assignments', error)
    return { error: 'Unable to remove user task assignments.' }
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
