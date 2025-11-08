import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  taskAssignees,
} from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { softDeleteUser } from '@/lib/queries/users'

import type { DeleteUserInput } from '../user-validation'
import type { UserServiceResult } from '../types'

export async function softDeletePortalUser(
  actor: AppUser,
  input: DeleteUserInput
): Promise<UserServiceResult> {
  assertAdmin(actor)

  const adminClient = getSupabaseServiceClient()
  const deletionTimestamp = await softDeleteUser(actor, input.id)

  const associationUpdates = [
    {
      context: 'client assignments',
      executor: async () =>
        db
          .update(clientMembers)
          .set({ deletedAt: deletionTimestamp })
          .where(
            and(
              eq(clientMembers.userId, input.id),
              isNull(clientMembers.deletedAt),
            ),
          ),
    },
    {
      context: 'task assignments',
      executor: async () =>
        db
          .update(taskAssignees)
          .set({ deletedAt: deletionTimestamp })
          .where(
            and(
              eq(taskAssignees.userId, input.id),
              isNull(taskAssignees.deletedAt),
            ),
          ),
    },
  ] as const

  for (const { executor, context } of associationUpdates) {
    try {
      await executor()
    } catch (error) {
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
