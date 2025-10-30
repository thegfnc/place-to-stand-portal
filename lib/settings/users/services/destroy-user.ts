import { getSupabaseServiceClient } from '@/lib/supabase/service'

import { cleanupAvatar } from '../user-service'
import type { DestroyUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function destroyPortalUser(
  input: DestroyUserInput
): Promise<UserServiceResult> {
  const adminClient = getSupabaseServiceClient()

  const { data: userRecord, error: userFetchError } = await adminClient
    .from('users')
    .select('avatar_url')
    .eq('id', input.id)
    .maybeSingle()

  if (userFetchError) {
    console.error('Failed to load user profile before destroy', userFetchError)
    return { error: 'Unable to permanently delete user.' }
  }

  const associationDeletions = [
    {
      context: 'client memberships',
      result: await adminClient
        .from('client_members')
        .delete()
        .eq('user_id', input.id),
    },
    {
      context: 'project memberships',
      result: await adminClient
        .from('project_members')
        .delete()
        .eq('user_id', input.id),
    },
    {
      context: 'task assignments',
      result: await adminClient
        .from('task_assignees')
        .delete()
        .eq('user_id', input.id),
    },
  ] as const

  for (const { context, result } of associationDeletions) {
    if (result.error) {
      console.error(`Failed to remove user ${context}`, result.error)
      return { error: `Unable to remove user ${context}.` }
    }
  }

  const { error: deleteProfileError } = await adminClient
    .from('users')
    .delete()
    .eq('id', input.id)

  if (deleteProfileError) {
    console.error(
      'Failed to delete user profile permanently',
      deleteProfileError
    )
    return { error: deleteProfileError.message }
  }

  await cleanupAvatar(adminClient, userRecord?.avatar_url)

  const authDelete = await adminClient.auth.admin.deleteUser(input.id)

  if (authDelete.error) {
    console.error('Failed to delete auth user permanently', authDelete.error)
    return { error: authDelete.error.message }
  }

  return {}
}
