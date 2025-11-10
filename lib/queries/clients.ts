import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm'

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
import {
  clampLimit,
  createSearchPattern,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'

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

const clientGroupByColumns = [
  clients.id,
  clients.name,
  clients.slug,
  clients.notes,
  clients.createdBy,
  clients.createdAt,
  clients.updatedAt,
  clients.deletedAt,
] as const

type ClientListMetrics = {
  totalProjects: number
  activeProjects: number
}

export type ClientsSettingsListItem = SelectClient & {
  metrics: ClientListMetrics
}

export type ClientsSettingsMembersMap = Record<
  string,
  Array<{
    id: string
    email: string
    fullName: string | null
  }>
>

export type ListClientsForSettingsInput = {
  status?: 'active' | 'archived'
  search?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

export type ClientsSettingsResult = {
  items: ClientsSettingsListItem[]
  membersByClient: ClientsSettingsMembersMap
  clientUsers: Array<{
    id: string
    email: string
    fullName: string | null
  }>
  totalCount: number
  pageInfo: PageInfo
}

const ACTIVE_STATUS = 'active'

function buildClientCursorCondition(
  direction: CursorDirection,
  cursor: { name?: string | null; id?: string | null } | null,
) {
  if (!cursor) {
    return null
  }

  const nameValue =
    typeof cursor.name === 'string' ? cursor.name : (cursor.name ?? '')
  const idValue = typeof cursor.id === 'string' ? cursor.id : ''

  if (!idValue) {
    return null
  }

  const normalizedName = sql`coalesce(${clients.name}, '')`

  if (direction === 'forward') {
    return sql`${normalizedName} > ${nameValue} OR (${normalizedName} = ${nameValue} AND ${clients.id} > ${idValue})`
  }

  return sql`${normalizedName} < ${nameValue} OR (${normalizedName} = ${nameValue} AND ${clients.id} < ${idValue})`
}

export async function listClientsForSettings(
  user: AppUser,
  input: ListClientsForSettingsInput = {},
): Promise<ClientsSettingsResult> {
  assertAdmin(user)

  const direction = resolveDirection(input.direction)
  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const searchQuery = input.search?.trim() ?? ''
  const baseConditions: SQL[] = []

  if (normalizedStatus === 'active') {
    baseConditions.push(isNull(clients.deletedAt))
  } else {
    baseConditions.push(sql`${clients.deletedAt} IS NOT NULL`)
  }

  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${clients.name} ILIKE ${pattern} OR ${clients.slug} ILIKE ${pattern})`,
    )
  }

  const cursorPayload = decodeCursor<{ name?: string; id?: string }>(
    input.cursor,
  )
  const cursorCondition = buildClientCursorCondition(direction, cursorPayload)

  const paginatedConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions

  const whereClause =
    paginatedConditions.length > 0
      ? and(...paginatedConditions)
      : undefined

  const ordering =
    direction === 'forward'
      ? [asc(clients.name), asc(clients.id)]
      : [desc(clients.name), desc(clients.id)]

  const rows = (await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
      notes: clients.notes,
      createdBy: clients.createdBy,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      deletedAt: clients.deletedAt,
      totalProjects: sql<number>`count(${projects.id})`,
      activeProjects: sql<number>`
        coalesce(sum(
          case
            when ${projects.deletedAt} is null
              and coalesce(lower(${projects.status}), '') = ${ACTIVE_STATUS}
            then 1
            else 0
          end
        ), 0)
      `,
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .where(whereClause)
    .groupBy(...clientGroupByColumns)
    .orderBy(...ordering)
    .limit(limit + 1)) as Array<
    SelectClient & {
      totalProjects: number | string | null
      activeProjects: number | string | null
    }
  >

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const mappedItems: ClientsSettingsListItem[] = normalizedRows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    metrics: {
      totalProjects: Number(row.totalProjects ?? 0),
      activeProjects: Number(row.activeProjects ?? 0),
    },
  }))

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(clients)
    .where(
      baseConditions.length ? and(...baseConditions) : undefined,
    )

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const firstItem = mappedItems[0] ?? null
  const lastItem = mappedItems[mappedItems.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward'
      ? Boolean(cursorPayload)
      : hasExtraRecord
  const hasNextPage =
    direction === 'forward'
      ? hasExtraRecord
      : Boolean(cursorPayload)

  const pageInfo: PageInfo = {
    hasPreviousPage,
    hasNextPage,
    startCursor: firstItem
      ? encodeCursor({
          name: firstItem.name ?? '',
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeCursor({
          name: lastItem.name ?? '',
          id: lastItem.id,
        })
      : null,
  }

  const clientIds = mappedItems.map(item => item.id)

  const [membersByClient, clientUsersList] = await Promise.all([
    buildMembersByClient(clientIds),
    listClientUsers(),
  ])

  return {
    items: mappedItems,
    membersByClient,
    clientUsers: clientUsersList,
    totalCount,
    pageInfo,
  }
}

async function buildMembersByClient(
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

async function listClientUsers() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
    })
    .from(users)
    .where(and(eq(users.role, 'CLIENT'), isNull(users.deletedAt)))
    .orderBy(asc(users.fullName), asc(users.email))

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
  }))
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

export async function generateUniqueClientSlugDrizzle(
  base: string,
  options: { initialCandidate?: string; startSuffix?: number } = {},
) {
  const normalizedBase = base || 'client'
  let candidate = options.initialCandidate ?? normalizedBase
  let suffix =
    options.startSuffix ??
    (candidate === normalizedBase ? 2 : extractSuffixFromCandidate(candidate, normalizedBase))

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

function extractSuffixFromCandidate(candidate: string, base: string): number {
  if (candidate === base) {
    return 2
  }

  const suffix = Number(candidate.replace(`${base}-`, ''))

  return Number.isFinite(suffix) && suffix >= 2 ? suffix + 1 : 2
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
