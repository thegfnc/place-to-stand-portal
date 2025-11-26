import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
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
import { clients, projects, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import {
  clampLimit,
  createSearchPattern,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'

import {
  buildProjectCursorCondition,
  projectFields,
  type ListProjectsForSettingsInput,
  projectGroupByColumns,
  projectSelection,
  type ProjectClientSummary,
  type ProjectOwnerSummary,
  type ProjectSelectionResult,
  type ProjectsSettingsListItem,
  type ProjectsSettingsResult,
  type SelectProject,
} from './listing-helpers'

export async function listProjectsForClient(
  user: AppUser,
  clientId: string,
): Promise<SelectProject[]> {
  await ensureClientAccess(user, clientId)

  return db
    .select(projectFields)
    .from(projects)
    .where(and(eq(projects.clientId, clientId), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name))
}

export async function listProjectsForUser(
  user: AppUser,
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
  projectId: string,
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

export async function listProjectsForSettings(
  user: AppUser,
  input: ListProjectsForSettingsInput = {},
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
    input.cursor,
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
      owner: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(users, eq(projects.createdBy, users.id))
    .where(whereClause)
    .groupBy(...projectGroupByColumns)
    .orderBy(...ordering)
    .limit(limit + 1)

  const rows = rawRows as Array<{
    project: ProjectSelectionResult
    client: ProjectClientSummary | null
    owner: ProjectOwnerSummary | null
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
    owner: row.owner
      ? {
          id: row.owner.id,
          fullName: row.owner.fullName,
          email: row.owner.email,
        }
      : row.project.createdBy
          ? {
              id: row.project.createdBy,
              fullName: null,
              email: null,
            }
          : null,
  }))

  const [totalResult, clientDirectory] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(baseConditions.length ? and(...baseConditions) : undefined),
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

export type {
  ListProjectsForSettingsInput,
  ProjectClientSummary,
  ProjectsSettingsListItem,
  ProjectsSettingsResult,
  SelectProject,
} from './listing-helpers'

