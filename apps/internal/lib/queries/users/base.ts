import 'server-only'

import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import { userFields, type SelectUser } from './fields'

export async function getUserById(
  user: AppUser,
  userId: string,
): Promise<SelectUser> {
  assertAdmin(user)

  const result = await db
    .select(userFields)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('User not found')
  }

  return result[0]
}
