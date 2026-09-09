import 'server-only'

import { cache } from 'react'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'

import type { ProjectTypeValue } from '@/lib/types'
import { db } from '@/lib/db'
import {
  clients as clientsTable,
  projects as projectsTable,
  taskAssigneeMetadata as taskAssigneeMetadataTable,
  taskAssignees as taskAssigneesTable,
  tasks as tasksTable,
} from '@/lib/db/schema'

export type AssignedTaskSummary = {
  id: string
  title: string
  description: string | null
  status: string
  dueOn: string | null
  updatedAt: string | null
  sortOrder: number | null
  project: {
    id: string
    name: string
    slug: string | null
    type: ProjectTypeValue
    createdBy: string | null
  }
  client: {
    id: string
    name: string
    slug: string | null
  } | null
}

export type AssignedTaskSummaryResult = {
  items: AssignedTaskSummary[]
  totalCount: number
  /**
   * Assigned DONE tasks that finished before `doneSince` and were therefore
   * withheld. Zero when no window is applied. Drives whether the board offers
   * to widen the window.
   */
  olderDoneCount: number
}

const DEFAULT_LIMIT = 12

/**
 * Shared row filter for "tasks assigned to this user that still matter":
 * not deleted, not archived, and not yet accepted.
 */
/**
 * ON clause for the (left) assignee join. Person-scoping and the soft-delete
 * filter live HERE, not in WHERE — in the everyone view an unassigned task
 * joins to no assignee row, and a WHERE filter on assignee columns would
 * silently drop it.
 */
function assigneeJoinCondition(userId: string | null) {
  return and(
    eq(taskAssigneesTable.taskId, tasksTable.id),
    isNull(taskAssigneesTable.deletedAt),
    ...(userId ? [eq(taskAssigneesTable.userId, userId)] : [])
  )
}

/**
 * Project scope shared by every My Tasks query: an optional single client,
 * and project types the board is hiding. A client selection already implies
 * CLIENT-type projects, so the type exclusion only bites in the all-clients
 * view — but it's applied unconditionally so the two never disagree.
 */
function projectScopeConditions(
  clientId: string | null,
  hiddenProjectTypes: readonly ProjectTypeValue[]
) {
  return [
    ...(clientId ? [eq(projectsTable.clientId, clientId)] : []),
    ...(hiddenProjectTypes.length > 0
      ? [notInArray(projectsTable.type, [...hiddenProjectTypes])]
      : []),
  ]
}

function assignedTaskConditions(userId: string | null) {
  return [
    // A person-scoped board keeps assigned-only semantics; the everyone
    // view (null) includes unassigned tasks — that's the planning session's
    // whole picture.
    ...(userId ? [isNotNull(taskAssigneesTable.userId)] : []),
    isNull(tasksTable.deletedAt),
    isNull(projectsTable.deletedAt),
    isNull(tasksTable.acceptedAt),
  ]
}

const STATUS_PRIORITY_SQL = sql`
  CASE
    WHEN ${tasksTable.status} = 'BLOCKED' THEN 0
    WHEN ${tasksTable.status} = 'IN_PROGRESS' THEN 1
    WHEN ${tasksTable.status} = 'ON_DECK' THEN 2
    WHEN ${tasksTable.status} = 'DONE' THEN 3
    ELSE 999
  END
`

type FetchAssignedTasksSummaryOptions = {
  /** Null = tasks assigned to ANYONE (the board's "All tasks" view). */
  userId: string | null
  /** Restrict to one client's projects (null/undefined = every client). */
  clientId?: string | null
  /** Project types to withhold (e.g. PERSONAL, INTERNAL); empty = show all. */
  hiddenProjectTypes?: readonly ProjectTypeValue[]
  limit?: number | null
  includeCompletedStatuses?: boolean
  /**
   * ISO instant. When set, DONE tasks completed before it are withheld;
   * every other status is unaffected. Keeps the board's Done column to a
   * rolling window instead of an ever-growing archive.
   */
  doneSince?: string | null
}

async function loadAssignedTaskSummaries({
  userId,
  clientId = null,
  hiddenProjectTypes = [],
  limit = DEFAULT_LIMIT,
  includeCompletedStatuses = true,
  doneSince = null,
}: FetchAssignedTasksSummaryOptions): Promise<AssignedTaskSummaryResult> {
  const normalizedLimit =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.max(1, limit)
      : limit === null
        ? null
        : DEFAULT_LIMIT

  const baseConditions = [
    ...assignedTaskConditions(userId),
    ...projectScopeConditions(clientId, hiddenProjectTypes),
  ]

  if (!includeCompletedStatuses) {
    baseConditions.push(ne(tasksTable.status, 'DONE'))
  }

  // Applies to DONE rows only, so the active columns never shrink. A DONE row
  // with a null completed_at stays visible on purpose: it would otherwise be
  // unreachable at every window size, and an extra card beats a lost one.
  const doneWindowCondition =
    includeCompletedStatuses && doneSince
      ? or(
          ne(tasksTable.status, 'DONE'),
          isNull(tasksTable.completedAt),
          gte(tasksTable.completedAt, doneSince)
        )
      : null

  if (doneWindowCondition) {
    baseConditions.push(doneWindowCondition)
  }

  const whereClause = and(...baseConditions)

  const orderExpressions = [
    sql`CASE WHEN ${taskAssigneeMetadataTable.sortOrder} IS NULL THEN 1 ELSE 0 END`,
    asc(taskAssigneeMetadataTable.sortOrder),
    sql`CASE WHEN ${tasksTable.dueOn} IS NULL THEN 1 ELSE 0 END`,
    asc(tasksTable.dueOn),
    STATUS_PRIORITY_SQL,
    desc(sql`COALESCE(${tasksTable.updatedAt}, ${tasksTable.createdAt})`),
    asc(tasksTable.title),
  ]

  const baseQuery = db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      dueOn: tasksTable.dueOn,
      updatedAt: tasksTable.updatedAt,
      createdAt: tasksTable.createdAt,
      sortOrder: taskAssigneeMetadataTable.sortOrder,
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        slug: projectsTable.slug,
        type: projectsTable.type,
        createdBy: projectsTable.createdBy,
      },
      client: {
        id: clientsTable.id,
        name: clientsTable.name,
        slug: clientsTable.slug,
      },
    })
    .from(tasksTable)
    .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .leftJoin(
      taskAssigneeMetadataTable,
      and(
        eq(taskAssigneeMetadataTable.taskId, tasksTable.id),
        eq(taskAssigneeMetadataTable.userId, taskAssigneesTable.userId),
        isNull(taskAssigneeMetadataTable.deletedAt)
      )
    )
    .where(whereClause)
    .orderBy(...orderExpressions)

  const rows =
    normalizedLimit !== null
      ? await baseQuery.limit(normalizedLimit)
      : await baseQuery

  // An unbounded query already returned every match — counting again
  // would repeat the full three-table join for a number we have.
  let totalCount = rows.length
  if (normalizedLimit !== null) {
    const totalResult = await db
      .select({
        count: sql<number>`count(distinct ${tasksTable.id})`,
      })
      .from(tasksTable)
      .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(whereClause)

    totalCount = Number(totalResult[0]?.count ?? 0)
  }

  const olderDoneCount = doneSince
    ? await countAssignedDoneBefore(
        userId,
        doneSince,
        clientId,
        hiddenProjectTypes
      )
    : 0

  // In the all-assignees view a task with two assignees joins to two rows;
  // keep the first (best-ordered) one. A single-user query never duplicates.
  const seenTaskIds = new Set<string>()
  const dedupedRows = rows.filter(row => {
    if (seenTaskIds.has(row.id)) {
      return false
    }
    seenTaskIds.add(row.id)
    return true
  })
  if (normalizedLimit === null) {
    totalCount = dedupedRows.length
  }

  const items: AssignedTaskSummary[] = dedupedRows.map(row => {
    const updatedSource = row.updatedAt ?? row.createdAt ?? null

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      status: row.status,
      dueOn: row.dueOn ?? null,
      updatedAt: updatedSource,
      sortOrder: row.sortOrder ?? null,
      project: {
        id: row.project.id,
        name: row.project.name,
        slug: row.project.slug ?? null,
        type: row.project.type as ProjectTypeValue,
        createdBy: row.project.createdBy ?? null,
      },
      client: row.client?.id
        ? {
            id: row.client.id,
            name: row.client.name ?? 'Unnamed client',
            slug: row.client.slug ?? null,
          }
        : null,
    }
  })

  return { items, totalCount, olderDoneCount }
}

/**
 * Assigned DONE tasks completed before `before`. Rows with a null
 * completed_at are excluded: they're always shown, so they're never "older".
 */
async function countAssignedDoneBefore(
  userId: string | null,
  before: string,
  clientId: string | null = null,
  hiddenProjectTypes: readonly ProjectTypeValue[] = []
): Promise<number> {
  const [result] = await db
    // Distinct: the all-assignees view joins one row per assignee.
    .select({ count: sql<number>`count(distinct ${tasksTable.id})` })
    .from(tasksTable)
    .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(
      and(
        ...assignedTaskConditions(userId),
        ...projectScopeConditions(clientId, hiddenProjectTypes),
        eq(tasksTable.status, 'DONE'),
        isNotNull(tasksTable.completedAt),
        lt(tasksTable.completedAt, before)
      )
    )

  return Number(result?.count ?? 0)
}

export type AssignedDoneSliceResult = {
  items: AssignedTaskSummary[]
  /** DONE tasks still older than this slice, for the next "load previous". */
  olderDoneCount: number
}

/**
 * One step of the board's "load previous two weeks": assigned DONE tasks
 * completed in `[since, before)`, plus how many remain beyond it.
 *
 * A half-open range rather than "everything since X" so widening appends only
 * what the client doesn't already have — the board keeps the rows it already
 * rendered instead of re-receiving and re-reconciling them.
 */
export async function listAssignedDoneSlice({
  userId,
  clientId = null,
  hiddenProjectTypes = [],
  since,
  before,
}: {
  userId: string | null
  clientId?: string | null
  hiddenProjectTypes?: readonly ProjectTypeValue[]
  since: string
  before: string
}): Promise<AssignedDoneSliceResult> {
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      dueOn: tasksTable.dueOn,
      updatedAt: tasksTable.updatedAt,
      createdAt: tasksTable.createdAt,
      sortOrder: taskAssigneeMetadataTable.sortOrder,
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        slug: projectsTable.slug,
        type: projectsTable.type,
        createdBy: projectsTable.createdBy,
      },
      client: {
        id: clientsTable.id,
        name: clientsTable.name,
        slug: clientsTable.slug,
      },
    })
    .from(tasksTable)
    .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .leftJoin(
      taskAssigneeMetadataTable,
      and(
        eq(taskAssigneeMetadataTable.taskId, tasksTable.id),
        eq(taskAssigneeMetadataTable.userId, taskAssigneesTable.userId),
        isNull(taskAssigneeMetadataTable.deletedAt)
      )
    )
    .where(
      and(
        ...assignedTaskConditions(userId),
        ...projectScopeConditions(clientId, hiddenProjectTypes),
        eq(tasksTable.status, 'DONE'),
        isNotNull(tasksTable.completedAt),
        gte(tasksTable.completedAt, since),
        lt(tasksTable.completedAt, before)
      )
    )
    .orderBy(desc(tasksTable.completedAt))

  // All-assignees view: one row per assignee per task — keep the first.
  const seenSliceTaskIds = new Set<string>()
  const dedupedSliceRows = rows.filter(row => {
    if (seenSliceTaskIds.has(row.id)) {
      return false
    }
    seenSliceTaskIds.add(row.id)
    return true
  })

  const items: AssignedTaskSummary[] = dedupedSliceRows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    dueOn: row.dueOn ?? null,
    updatedAt: row.updatedAt ?? row.createdAt ?? null,
    sortOrder: row.sortOrder ?? null,
    project: {
      id: row.project.id,
      name: row.project.name,
      slug: row.project.slug ?? null,
      type: row.project.type as ProjectTypeValue,
      createdBy: row.project.createdBy ?? null,
    },
    client: row.client?.id
      ? {
          id: row.client.id,
          name: row.client.name ?? 'Unnamed client',
          slug: row.client.slug ?? null,
        }
      : null,
  }))

  return {
    items,
    olderDoneCount: await countAssignedDoneBefore(
      userId,
      since,
      clientId,
      hiddenProjectTypes
    ),
  }
}

export const fetchAssignedTasksSummary = cache(
  (options: FetchAssignedTasksSummaryOptions) =>
    loadAssignedTaskSummaries(options)
)

export function listAssignedTaskSummaries(
  options: FetchAssignedTasksSummaryOptions
) {
  return loadAssignedTaskSummaries(options)
}

/**
 * Resolve a task's project without hydrating any project graph — used by
 * the My Tasks deep-link path to merge in a project outside the assigned
 * set. Soft-deleted tasks resolve to null (matches the previous behavior
 * of searching active task arrays only).
 */
export async function getActiveTaskProjectId(
  taskId: string
): Promise<string | null> {
  const rows = await db
    .select({ projectId: tasksTable.projectId })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), isNull(tasksTable.deletedAt)))
    .limit(1)

  return rows[0]?.projectId ?? null
}
