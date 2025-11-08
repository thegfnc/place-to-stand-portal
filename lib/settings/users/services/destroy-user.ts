import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteClientMemberships,
  deleteTaskAssignments,
  deleteUserProfile,
  findUserById,
} from '@/lib/db/settings/users'

import { cleanupAvatar } from '../user-service'
import type { DestroyUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function destroyPortalUser(
  input: DestroyUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()
  let userRecord: { avatar_url: string | null } | undefined

  try {
    userRecord = await findUserById(input.id)
  } catch (error) {
    console.error('Failed to load user profile before destroy', error)
    return { error: 'Unable to permanently delete user.' }
  }

  if (!userRecord) {
    return { error: 'User not found.' }
  }

  try {
    await deleteClientMemberships(input.id)
  } catch (error) {
    console.error('Failed to remove user client memberships', error)
    return { error: 'Unable to remove user client memberships.' }
  }

  try {
    await deleteTaskAssignments(input.id)
  } catch (error) {
    console.error('Failed to remove user task assignments', error)
    return { error: 'Unable to remove user task assignments.' }
  }

  try {
    await deleteUserProfile(input.id)
  } catch (error) {
    console.error('Failed to delete user profile permanently', error)
    const message =
      error instanceof Error ? error.message : 'Unable to delete user profile.'
    return { error: message }
  }

  await cleanupAvatar(adminClient, userRecord?.avatar_url)

  const authDelete = await adminClient.auth.admin.deleteUser(input.id)

  if (authDelete.error) {
    console.error('Failed to delete auth user permanently', authDelete.error)
    return { error: authDelete.error.message }
  }

  return {}
}
