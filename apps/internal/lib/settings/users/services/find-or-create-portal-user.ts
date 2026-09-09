import { and, eq, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { userRestoredEvent } from '@/lib/activity/events'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import { dispatchPortalInvite } from '../user-service'
import { createPortalUser } from './create-user'
import type { UserServiceResult } from '../types'

export type FindOrCreatePortalUserResult = UserServiceResult & {
  /**
   * True when this call inserted a `users` row (fresh account or a missing
   * profile for an existing auth user). False for a found or restored row, so
   * the caller can log USER_CREATED only when a user actually came into being.
   */
  created?: boolean
}

/**
 * Finds an existing portal user by email or creates a new one.
 *
 * Handles the case where a Supabase auth user exists but there is no
 * corresponding row in the `users` table (e.g. created through the client
 * portal sign-up flow, or left behind by a previously failed operation).
 */
export async function findOrCreatePortalUser(
  actor: AppUser,
  input: { email: string; fullName: string | null }
): Promise<FindOrCreatePortalUserResult> {
  assertAdmin(actor)

  // 1. Check our users table for an active user
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
    .limit(1)

  if (existingUser) {
    return { userId: existingUser.id, created: false }
  }

  // 2. Try creating through the normal flow (handles auth + DB + invite)
  const createResult = await createPortalUser(actor, {
    email: input.email,
    fullName: input.fullName ?? input.email,
    role: 'CLIENT',
  })

  if (!createResult.error) {
    return { ...createResult, created: true }
  }

  // 3. If "already registered", the auth user exists but our DB doesn't have them
  if (!createResult.error.includes('already been registered')) {
    return createResult
  }

  // 4. Look up the existing auth user via raw SQL on auth.users
  const [authRow] = await db.execute<{ id: string }>(
    sql`SELECT id FROM auth.users WHERE email = ${input.email} LIMIT 1`
  )

  const authUserId = authRow?.id
  if (!authUserId) {
    return { error: 'Unable to find existing auth account.' }
  }

  // 5. Check if there's a soft-deleted users row we can restore
  const [deletedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1)

  let created = false

  if (deletedUser) {
    // Restore the soft-deleted row
    await db
      .update(users)
      .set({ deletedAt: null, updatedAt: new Date().toISOString() })
      .where(eq(users.id, authUserId))

    const restored = userRestoredEvent({
      fullName: input.fullName ?? input.email,
      email: input.email,
      role: 'CLIENT',
    })
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      verb: restored.verb,
      summary: restored.summary,
      targetType: 'USER',
      targetId: authUserId,
      metadata: restored.metadata,
    })
  } else {
    // Create the missing users table row
    await db.insert(users).values({
      id: authUserId,
      email: input.email,
      fullName: input.fullName ?? input.email,
      role: 'CLIENT',
    })
    created = true
  }

  // 6. Confirm the account and send an invite so they can sign in.
  //
  // Deliberately does NOT set a password. This user already exists, so they may
  // have chosen their own — overwriting it would lock them out of a credential
  // they believe they have, and for anyone signing in with Google it would be
  // destroying a credential to no purpose. The invite link below is what gets
  // them in; `/forgot-password` covers them if they want a password back.
  const adminClient = getSupabaseServiceClient()

  const updateResult = await adminClient.auth.admin.updateUserById(authUserId, {
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName ?? input.email,
      role: 'CLIENT',
      must_reset_password: true,
    },
  })

  if (updateResult.error) {
    console.error('Failed to update existing auth user', updateResult.error)
    return { error: 'Unable to update the existing account.' }
  }

  try {
    await dispatchPortalInvite({
      email: input.email,
      fullName: input.fullName ?? input.email,
    })
  } catch (error) {
    console.error('Failed to send invite to existing auth user', error)
    // Non-fatal: the account is linked, they just won't get the email. Unlike
    // createPortalUser there is nothing to roll back — the contact is real and
    // already associated. They can request a link from the sign-in page.
  }

  return { userId: authUserId, created }
}
