import 'server-only'

import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  assertAdmin,
  ensureClientAccess,
  isAdmin,
  listAccessibleClientIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  clients,
  hourBlocks,
  projects,
  users,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

type SelectClient = typeof clients.$inferSelect

const clientFields = {
  id: clients.id,
  name: clients.name,
  slug: clients.slug,
  notes: clients.notes,
  createdBy: clients.createdBy,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
  deletedAt: clients.deletedAt,
}

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

type ClientSettingsSnapshot = {
  clients: Array<
    SelectClient & {
      projects: Array<{
        id: string
        deletedAt: string | null
        status: string | null
      }>
    }
  >
  members: Array<{
    clientId: string
    userId: string
    email: string
    fullName: string | null
  }>
  clientUsers: Array<{
    id: string
    email: string
    fullName: string | null
  }>
}

export async function getClientsSettingsSnapshot(
  user: AppUser,
): Promise<ClientSettingsSnapshot> {
  assertAdmin(user)

  const [clientRows, projectRows, memberRows, clientUserRows] =
    await Promise.all([
      db
        .select({
          id: clients.id,
          name: clients.name,
          slug: clients.slug,
          notes: clients.notes,
          createdBy: clients.createdBy,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt,
          deletedAt: clients.deletedAt,
        })
        .from(clients)
        .orderBy(asc(clients.name)),
      db
        .select({
          id: projects.id,
          clientId: projects.clientId,
          status: projects.status,
          deletedAt: projects.deletedAt,
        })
        .from(projects),
      db
        .select({
          clientId: clientMembers.clientId,
          userId: clientMembers.userId,
          email: users.email,
          fullName: users.fullName,
          userDeletedAt: users.deletedAt,
        })
        .from(clientMembers)
        .innerJoin(users, eq(users.id, clientMembers.userId))
        .where(
          and(
            isNull(clientMembers.deletedAt),
            isNull(users.deletedAt),
            eq(users.role, 'CLIENT'),
          ),
        ),
      db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        })
        .from(users)
        .where(and(eq(users.role, 'CLIENT'), isNull(users.deletedAt)))
        .orderBy(asc(users.fullName), asc(users.email)),
    ])

  const projectsByClient = projectRows.reduce<
    Record<
      string,
      Array<{ id: string; deletedAt: string | null; status: string | null }>
    >
  >((acc, project) => {
    const list = acc[project.clientId] ?? []
    list.push({
      id: project.id,
      deletedAt: project.deletedAt,
      status: project.status,
    })
    acc[project.clientId] = list
    return acc
  }, {})

  const filteredMembers = memberRows.reduce<
    Array<{
      clientId: string
      userId: string
      email: string
      fullName: string | null
    }>
  >((acc, member) => {
    if (member.userDeletedAt) {
      return acc
    }

    acc.push({
      clientId: member.clientId,
      userId: member.userId,
      email: member.email,
      fullName: member.fullName,
    })

    return acc
  }, [])

  return {
    clients: clientRows.map(client => ({
      ...client,
      projects: projectsByClient[client.id] ?? [],
    })),
    members: filteredMembers,
    clientUsers: clientUserRows,
  }
}

export async function clientSlugExistsDrizzle(
  slug: string,
  options: { excludeId?: string } = {},
) {
  const conditions = [eq(clients.slug, slug)]

  if (options.excludeId) {
    conditions.push(ne(clients.id, options.excludeId))
  }

  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .limit(1)

  return rows.length > 0
}

export async function generateUniqueClientSlugDrizzle(base: string) {
  const normalizedBase = base || 'client'
  let candidate = normalizedBase
  let suffix = 2
  let attempt = 0

  while (attempt < 3) {
    const exists = await clientSlugExistsDrizzle(candidate)

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1
    attempt += 1
  }

  return `${normalizedBase}-${Date.now()}`
}

export async function countProjectsForClient(clientId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(projects)
    .where(eq(projects.clientId, clientId))

  return Number(result[0]?.count ?? 0)
}

export async function countHourBlocksForClient(clientId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(hourBlocks)
    .where(eq(hourBlocks.clientId, clientId))

  return Number(result[0]?.count ?? 0)
}
