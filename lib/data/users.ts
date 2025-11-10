import 'server-only'

import { cache } from 'react'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users as usersTable } from '@/lib/db/schema'
import type { DbUser } from '@/lib/types'

export const fetchAdminUsers = cache(async (): Promise<DbUser[]> => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
      avatarUrl: usersTable.avatarUrl,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      deletedAt: usersTable.deletedAt,
    })
    .from(usersTable)
    .where(and(eq(usersTable.role, 'ADMIN'), isNull(usersTable.deletedAt)))
    .orderBy(asc(usersTable.fullName), asc(usersTable.email))

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role,
    avatar_url: row.avatarUrl,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  }))
})
