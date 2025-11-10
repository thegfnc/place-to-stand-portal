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
  ensureClientAccessByProjectId,
  isAdmin,
  listAccessibleProjectIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clients,
  projects,
  tasks,
  timeLogs,
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

type SelectProject = typeof projects.$inferSelect

const projectFields = {
  id: projects.id,
  clientId: projects.clientId,
  name: projects.name,
  status: projects.status,
  startsOn: projects.startsOn,
  endsOn: projects.endsOn,
  slug: projects.slug,
  createdBy: projects.createdBy,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  deletedAt: projects.deletedAt,
}

export async function listProjectsForClient(
  user: AppUser,
  clientId: string
): Promise<SelectProject[]> {
  await ensureClientAccess(user, clientId)

  return db
    .select(projectFields)
    .from(projects)
    .where(and(eq(projects.clientId, clientId), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name))
}

export async function listProjectsForUser(
  user: AppUser
): Promise<SelectProject[]> {
  if (isAdmin(user)) {
    return db
      .select(projectFields)
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(asc(projects.name))
  }

  const projectIds = await listAccessibleProjectIds(user)

  if (!projectIds.length) {
    return []
  }

  return db
    .select(projectFields)
    .from(projects)
    .where(and(inArray(projects.id, projectIds), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name))
}

export async function getProjectById(
  user: AppUser,
  projectId: string
): Promise<SelectProject> {
  await ensureClientAccessByProjectId(user, projectId)

  const result = await db
    .select(projectFields)
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Project not found')
  }

  return result[0]
}

type ProjectClientSummary = {
  id: string
  name: string
  deletedAt: string | null
}

export type ProjectsSettingsListItem = typeof projects.$inferSelect & {
  client: ProjectClientSummary | null
}

export type ListProjectsForSettingsInput = {
  status?: 'active' | 'archived'
  search?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

export type ProjectsSettingsResult = {
  items: ProjectsSettingsListItem[]
  totalCount: number
  pageInfo: PageInfo
  clients: ProjectClientSummary[]
}

const projectGroupByColumns = [
  projects.id,
  projects.name,
  projects.status,
  projects.slug,
  projects.clientId,
  projects.createdBy,
  projects.startsOn,
  projects.endsOn,
  projects.createdAt,
  projects.updatedAt,
  projects.deletedAt,
  clients.id,
  clients.name,
  clients.deletedAt,
] as const

const projectSelection = {
  id: projects.id,
  name: projects.name,
  status: projects.status,
  slug: projects.slug,
  clientId: projects.clientId,
  createdBy: projects.createdBy,
  startsOn: projects.startsOn,
  endsOn: projects.endsOn,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  deletedAt: projects.deletedAt,
} as const

type ProjectSelectionResult = {
  id: string
  name: string
  status: string
  slug: string | null
  clientId: string
  createdBy: string | null
  startsOn: string | null
  endsOn: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

function buildProjectCursorCondition(
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

  const normalizedName = sql`coalesce(${projects.name}, '')`

  if (direction === 'forward') {
    return sql`${normalizedName} > ${nameValue} OR (${normalizedName} = ${nameValue} AND ${projects.id} > ${idValue})`
  }

  return sql`${normalizedName} < ${nameValue} OR (${normalizedName} = ${nameValue} AND ${projects.id} < ${idValue})`
}

export async function listProjectsForSettings(
  user: AppUser,
  input: ListProjectsForSettingsInput = {}
): Promise<ProjectsSettingsResult> {
  assertAdmin(user)

  const direction = resolveDirection(input.direction)
  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const searchQuery = input.search?.trim() ?? ''

  const baseConditions: SQL[] = []

  if (normalizedStatus === 'active') {
    baseConditions.push(isNull(projects.deletedAt))
  } else {
    baseConditions.push(sql`${projects.deletedAt} IS NOT NULL`)
  }

  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${projects.name} ILIKE ${pattern} OR ${projects.slug} ILIKE ${pattern})`,
    )
  }

  const cursorPayload = decodeCursor<{ name?: string; id?: string }>(
    input.cursor
  )
  const cursorCondition = buildProjectCursorCondition(direction, cursorPayload)

  const paginatedConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions

  const whereClause =
    paginatedConditions.length > 0 ? and(...paginatedConditions) : undefined

  const ordering =
    direction === 'forward'
      ? [asc(projects.name), asc(projects.id)]
      : [desc(projects.name), desc(projects.id)]

  const rawRows = await db
    .select({
      project: projectSelection,
      client: {
        id: clients.id,
        name: clients.name,
        deletedAt: clients.deletedAt,
      },
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(whereClause)
    .groupBy(...projectGroupByColumns)
    .orderBy(...ordering)
    .limit(limit + 1)

  const rows = rawRows as Array<{
    project: ProjectSelectionResult
    client: ProjectClientSummary | null
  }>

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const mappedItems: ProjectsSettingsListItem[] = normalizedRows.map(row => ({
    ...row.project,
    client: row.project.clientId
      ? row.client && row.client.id
        ? {
            id: row.client.id,
            name: row.client.name,
            deletedAt: row.client.deletedAt,
          }
        : null
      : null,
  }))

  const [totalResult, clientDirectory] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(
        baseConditions.length ? and(...baseConditions) : undefined,
      ),
    db
      .select({
        id: clients.id,
        name: clients.name,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .orderBy(asc(clients.name)),
  ])

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const firstItem = mappedItems[0] ?? null
  const lastItem = mappedItems[mappedItems.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward' ? Boolean(cursorPayload) : hasExtraRecord
  const hasNextPage =
    direction === 'forward' ? hasExtraRecord : Boolean(cursorPayload)

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

  return {
    items: mappedItems,
    totalCount,
    pageInfo,
    clients: clientDirectory.map(client => ({
      id: client.id,
      name: client.name,
      deletedAt: client.deletedAt,
    })),
  }
}

export async function projectSlugExistsDrizzle(
  slug: string,
  options: { excludeId?: string } = {}
) {
  const conditions = [eq(projects.slug, slug)]

  if (options.excludeId) {
    conditions.push(ne(projects.id, options.excludeId))
  }

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .limit(1)

  return rows.length > 0
}

export async function generateUniqueProjectSlugDrizzle(
  base: string
) {
  const normalizedBase = base || 'project'
  let candidate = normalizedBase
  let suffix = 2

  while (true) {
    const exists = await projectSlugExistsDrizzle(candidate)

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1

    if (suffix > 5) {
      return `${normalizedBase}-${Date.now()}`
    }
  }
}

export async function countTasksForProject(projectId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))

  return Number(result[0]?.count ?? 0)
}

export async function countTimeLogsForProject(projectId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(timeLogs)
    .where(eq(timeLogs.projectId, projectId))

  return Number(result[0]?.count ?? 0)
}
