import 'server-only'

import type { User } from '@supabase/supabase-js'

import { eq } from 'drizzle-orm'

import type { UserRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users as usersTable } from '@/lib/db/schema'

const DEFAULT_ROLE: UserRole = 'CLIENT'

const VALID_ROLES: readonly UserRole[] = ['ADMIN', 'CLIENT']

function getMetadataRole(user: User): UserRole | null {
  const rawRole = user.user_metadata?.role

  if (typeof rawRole !== 'string') {
    return null
  }

  const role = rawRole.toUpperCase() as UserRole

  return VALID_ROLES.includes(role) ? role : null
}

export async function ensureUserProfile(user: User) {
  const existingRows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      fullName: usersTable.fullName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1)

  const existing = existingRows[0]

  const metadataRole = getMetadataRole(user)
  const resolvedRole = metadataRole ?? existing?.role ?? DEFAULT_ROLE

  const nextEmail = user.email ?? ''
  const nextFullName = (user.user_metadata?.full_name as string | undefined) ?? null
  const nextAvatar = (user.user_metadata?.avatar_url as string | undefined) ?? null

  if (!existing) {
    await db.insert(usersTable).values({
      id: user.id,
      email: nextEmail,
      fullName: nextFullName,
      role: resolvedRole,
      avatarUrl: nextAvatar,
      deletedAt: null,
    })
    return
  }

  const shouldUpdate =
    existing.email !== nextEmail ||
    existing.role !== resolvedRole ||
    existing.fullName !== nextFullName ||
    existing.avatarUrl !== nextAvatar

  if (!shouldUpdate) {
    return
  }

  await db
    .update(usersTable)
    .set({
      email: nextEmail,
      fullName: nextFullName,
      role: resolvedRole,
      avatarUrl: nextAvatar,
      deletedAt: null,
    })
    .where(eq(usersTable.id, user.id))
}
