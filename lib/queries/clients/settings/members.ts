'use server'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientMembers, users } from '@/lib/db/schema'

import type { ClientsSettingsMembersMap } from './types'

export async function buildMembersByClient(
  clientIds: string[],
): Promise<ClientsSettingsMembersMap> {
  if (!clientIds.length) {
    return {}
  }

  const rows = await db
    .select({
      clientId: clientMembers.clientId,
      userId: clientMembers.userId,
      email: users.email,
      fullName: users.fullName,
      memberDeletedAt: clientMembers.deletedAt,
      userDeletedAt: users.deletedAt,
    })
    .from(clientMembers)
    .innerJoin(users, eq(users.id, clientMembers.userId))
    .where(
      and(
        inArray(clientMembers.clientId, clientIds),
        isNull(clientMembers.deletedAt),
        eq(users.role, 'CLIENT'),
        isNull(users.deletedAt),
      ),
    )

  return rows.reduce<ClientsSettingsMembersMap>((acc, row) => {
    if (row.memberDeletedAt || row.userDeletedAt) {
      return acc
    }

    const list = acc[row.clientId] ?? []
    list.push({
      id: row.userId,
      email: row.email,
      fullName: row.fullName,
    })
    acc[row.clientId] = list
    return acc
  }, {})
}

