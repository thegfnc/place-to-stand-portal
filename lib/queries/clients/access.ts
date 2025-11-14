'use server'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureClientAccess,
  isAdmin,
  listAccessibleClientIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import { clientFields, type SelectClient } from './selectors'

export async function listClientsForUser(
  user: AppUser,
): Promise<SelectClient[]> {
  if (isAdmin(user)) {
    return db
      .select(clientFields)
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.name))
  }

  const clientIds = await listAccessibleClientIds(user)

  if (!clientIds.length) {
    return []
  }

  return db
    .select(clientFields)
    .from(clients)
    .where(and(inArray(clients.id, clientIds), isNull(clients.deletedAt)))
    .orderBy(asc(clients.name))
}

export async function getClientById(
  user: AppUser,
  clientId: string,
): Promise<SelectClient> {
  await ensureClientAccess(user, clientId)

  const result = await db
    .select(clientFields)
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Client not found')
  }

  return result[0]
}

