import 'server-only'

import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin, ensureProjectAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import {
  clampLimit,
  createSearchPattern,
  resolveDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'
import {
  decodeSortCursor,
  encodeSortCursor,
} from '@/lib/pagination/sort'
import {
  DEFAULT_PROJECTS_SORT,
  type ProjectSortField,
} from './sort'

import {
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

export async function getProjectById(
  user: AppUser,
  projectId: string,
): Promise<SelectProject> {
  await ensureProjectAccess(user, projectId)

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


// PRD 004 §03 (R5): per-sort descriptors for the settings/archive list.
type ProjectSortDescriptor = {
  encode: (row: { name: string | null; createdAt: string | Date | null }) => string
  compare: (op: 'gt' | 'lt', value: string) => SQL
  equals: (value: string) => SQL
  orderAsc: SQL
  orderDesc: SQL
}

const PROJECT_SORT_DESCRIPTORS: Record<ProjectSortField, ProjectSortDescriptor> = {
  name: {
    encode: row => row.name ?? '',
    compare: (op, value) =>
      op === 'gt'
        ? sql`${projects.name} > ${value}`
        : sql`${projects.name} < ${value}`,
    equals: value => sql`${projects.name} = ${value}`,
    orderAsc: sql`${projects.name} ASC`,
    orderDesc: sql`${projects.name} DESC`,
  },
  created: {
    encode: row => String(row.createdAt ?? ''),
    compare: (op, value) =>
      op === 'gt'
        ? sql`${projects.createdAt} > ${value}::timestamptz`
        : sql`${projects.createdAt} < ${value}::timestamptz`,
    equals: value => sql`${projects.createdAt} = ${value}::timestamptz`,
    orderAsc: sql`${projects.createdAt} ASC`,
    orderDesc: sql`${projects.createdAt} DESC`,
  },
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

  const statusCondition: SQL =
    normalizedStatus === 'active'
      ? sql`${projects.deletedAt} IS NULL`
      : sql`${projects.deletedAt} IS NOT NULL`

  const baseConditions: SQL[] = [statusCondition]

  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${projects.name} ILIKE ${pattern} OR ${projects.slug} ILIKE ${pattern})`,
    )
  }

  const sort = input.sort ?? DEFAULT_PROJECTS_SORT
  const descriptor = PROJECT_SORT_DESCRIPTORS[sort.field]

  // Field-tagged cursor (R5): payloads minted under a different sort are
  // rejected and we serve page one.
  const cursorPayload = decodeSortCursor(
    input.cursor,
    sort.field,
    sort.direction
  )

  const effectiveAsc = (sort.direction === 'asc') === (direction === 'forward')
  const cursorCondition = cursorPayload
    ? sql`(${descriptor.compare(effectiveAsc ? 'gt' : 'lt', cursorPayload.value ?? '')} OR (${descriptor.equals(cursorPayload.value ?? '')} AND ${effectiveAsc ? sql`${projects.id} > ${cursorPayload.id}` : sql`${projects.id} < ${cursorPayload.id}`}))`
    : null

  const paginatedConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions

  const whereClause =
    paginatedConditions.length > 0 ? and(...paginatedConditions) : undefined

  const ordering = effectiveAsc
    ? [descriptor.orderAsc, asc(projects.id)]
    : [descriptor.orderDesc, desc(projects.id)]

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

  const [totalResult, unfilteredTotalResult, clientDirectory] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(baseConditions.length ? and(...baseConditions) : undefined),
    // Status-scoped only — the `M` in `Showing N of M` (PRD 004 §03).
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(statusCondition),
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
  const unfilteredTotalCount = Number(unfilteredTotalResult[0]?.count ?? 0)
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
      ? encodeSortCursor({
          sortField: sort.field,
          sortDirection: sort.direction,
          value: descriptor.encode(firstItem),
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeSortCursor({
          sortField: sort.field,
          sortDirection: sort.direction,
          value: descriptor.encode(lastItem),
          id: lastItem.id,
        })
      : null,
  }

  return {
    items: mappedItems,
    totalCount,
    unfilteredTotalCount,
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
  
  ProjectsSettingsListItem,
  ProjectsSettingsResult,
  SelectProject,
} from './listing-helpers'

