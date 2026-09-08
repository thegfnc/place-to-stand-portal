'use server'

import { asc, eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { clientFields, type SelectClient } from './selectors'

/**
 * Fetches all clients (including archived) for the project sheet dropdown.
 * Admin-only — needed so newly created clients appear even before they have projects.
 */
export async function fetchClientDirectory(): Promise<
  Array<{ id: string; name: string; deletedAt: string | null }>
> {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      deletedAt: clients.deletedAt,
    })
    .from(clients)
    .orderBy(asc(clients.name))
}

/**
 * By-id fetch that keeps archived clients — the `?client=` deep-link resolver
 * needs the soft-deleted row so a shared link can cross-redirect to the
 * archive tab instead of reporting a dead link.
 */
export async function getClientByIdIncludingArchived(
  user: AppUser,
  clientId: string,
): Promise<SelectClient | null> {
  assertAdmin(user)

  const result = await db
    .select(clientFields)
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)

  return result[0] ?? null
}
