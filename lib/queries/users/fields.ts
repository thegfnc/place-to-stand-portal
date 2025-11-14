import { sql } from 'drizzle-orm'

import { users } from '@/lib/db/schema'

export type SelectUser = typeof users.$inferSelect

export const userFields = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
}

export const userSortExpression = sql<string>`
  coalesce(nullif(${users.fullName}, ''), ${users.email}, '')
`

