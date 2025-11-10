import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  taskAssignees,
  users,
} from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getUserById } from '@/lib/queries/users'

import { cleanupAvatar } from '../user-service'
import type { DestroyUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function destroyPortalUser(
  actor: AppUser,
  input: DestroyUserInput
): Promise<UserServiceResult> {
  assertAdmin(actor)

  const adminClient = getSupabaseServiceClient()

  let avatarPath: string | null = null

  try {
    const userRecord = await getUserById(actor, input.id)
    avatarPath = userRecord.avatarUrl ?? null
  } catch (error) {
    console.error('Failed to load user profile before destroy', error)
    return { error: 'Unable to permanently delete user.' }
  }

  const associationDeletions = [
    {
      context: 'client memberships',
      executor: async () =>
        db.delete(clientMembers).where(eq(clientMembers.userId, input.id)),
    },
    {
      context: 'task assignments',
      executor: async () =>
        db.delete(taskAssignees).where(eq(taskAssignees.userId, input.id)),
    },
  ] as const

  for (const { context, executor } of associationDeletions) {
    try {
      await executor()
    } catch (error) {
      console.error(`Failed to remove user ${context}`, error)
      return { error: `Unable to remove user ${context}.` }
    }
  }

  try {
    await db.delete(users).where(eq(users.id, input.id))
  } catch (error) {
    console.error('Failed to delete user profile permanently', error)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to permanently delete user profile.',
    }
  }

  await cleanupAvatar(adminClient, avatarPath)

  const authDelete = await adminClient.auth.admin.deleteUser(input.id)

  if (authDelete.error) {
    console.error('Failed to delete auth user permanently', authDelete.error)
    return { error: authDelete.error.message }
  }

  return {}
}
