import 'server-only'

import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function softDeleteUser(
  user: AppUser,
  userId: string,
): Promise<string> {
  assertAdmin(user)

  const deletedAt = new Date().toISOString()

  await db
    .update(users)
    .set({ deletedAt })
    .where(eq(users.id, userId))

  return deletedAt
}

export async function restoreUser(user: AppUser, userId: string) {
  assertAdmin(user)

  await db
    .update(users)
    .set({ deletedAt: null })
    .where(eq(users.id, userId))
}

