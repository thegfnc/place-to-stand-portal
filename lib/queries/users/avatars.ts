import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

export async function getUserAvatarPath(userId: string): Promise<string> {
  const result = await db
    .select({
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Avatar not found')
  }

  const avatarUrl = result[0].avatarUrl

  if (!avatarUrl) {
    throw new NotFoundError('Avatar not found')
  }

  return avatarUrl
}

