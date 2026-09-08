import 'server-only'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export type StaffMember = {
  id: string
  name: string
  email: string
}

/** Active admins — the people who get cc'd on client updates by default. */
export async function fetchActiveStaff(): Promise<StaffMember[]> {
  const rows = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.role, 'ADMIN'),
        isNull(users.deletedAt),
        isNull(users.disabledAt)
      )
    )
    .orderBy(asc(users.fullName), asc(users.email))

  return rows.map(row => ({
    id: row.id,
    name: row.fullName?.trim() || row.email,
    email: row.email.toLowerCase(),
  }))
}
