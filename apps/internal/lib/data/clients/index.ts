import 'server-only'

import { cache } from 'react'
import { aliasedTable, and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contacts, projects, users } from '@/lib/db/schema'
import {
  clientHoursTotalsFor,
  getClientHoursTotals,
} from '@pts/db/hours'
import { NotFoundError } from '@/lib/errors/http'
import { createSearchPattern } from '@/lib/pagination/cursor'
import {
  fetchContactSummariesByClient,
  type ClientContactSummary,
} from '@/lib/queries/clients/contact-summaries'
import type { ProjectStatusValue } from '@/lib/constants'

export type { ClientContactSummary }

export type ClientProjectSummary = {
  id: string
  name: string
  slug: string | null
  status: ProjectStatusValue
}

export type ClientWithMetrics = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  website: string | null
  billingType: 'prepaid' | 'net_30'
  state: string | null
  originationContactId: string | null
  originationContactName: string | null
  originationUserId: string | null
  originationUserName: string | null
  originationUserAvatarUrl: string | null
  originationUserUpdatedAt: string | null
  closerUserId: string | null
  closerUserName: string | null
  closerUserAvatarUrl: string | null
  closerUserUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  projectCount: number
  activeProjectCount: number
  activeProjects: ClientProjectSummary[]
  allProjects: ClientProjectSummary[]
  /** Live contacts linked through `contact_clients`, name-ordered. */
  contacts: ClientContactSummary[]
  totalHoursPurchased: number
  totalHoursUsed: number
  hoursRemaining: number
}

export type ClientDetail = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  website: string | null
  state: string | null
  originationContactId: string | null
  originationUserId: string | null
  closerUserId: string | null
  billingType: 'prepaid' | 'net_30'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export const fetchClientsWithMetrics = cache(
  async (
    user: AppUser,
    search?: string,
    billingType?: 'prepaid' | 'net_30'
  ): Promise<ClientWithMetrics[]> => {
    assertAdmin(user)

    const baseConditions = [isNull(clients.deletedAt)]

    // PRD 004 §03: server-side `?q=` search on the clients landing table.
    // Must match name OR slug — the shell header count comes from
    // `listClientsForSettings`, whose predicate searches both; a narrower
    // predicate here shows a nonzero count with zero rows.
    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const pattern = createSearchPattern(trimmedSearch)
      baseConditions.push(
        sql`(${clients.name} ILIKE ${pattern} OR ${clients.slug} ILIKE ${pattern})`
      )
    }

    // PRD 004 §03: `?billing=` filter shares the landing table's conditions.
    if (billingType) {
      baseConditions.push(eq(clients.billingType, billingType))
    }

    // Aliased user joins: the clients table references users three times
    // (createdBy, origination, closer) so we need distinct table aliases for
    // the two user joins we care about here.
    const originationUsers = aliasedTable(users, 'origination_users')
    const closerUsers = aliasedTable(users, 'closer_users')

    // Base client data. Project counts are derived below from the per-client
    // project rows we fetch anyway — the previous projects join + 21-column
    // GROUP BY fanned out clients × projects only to count rows the second
    // query re-fetched. The remaining joins are all many-to-one, so this
    // returns exactly one row per client with no grouping.
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        notes: clients.notes,
        website: clients.website,
        billingType: clients.billingType,
        state: clients.state,
        originationContactId: clients.originationContactId,
        originationContactName: contacts.name,
        originationUserId: clients.originationUserId,
        originationUserName: originationUsers.fullName,
        originationUserEmail: originationUsers.email,
        originationUserAvatarUrl: originationUsers.avatarUrl,
        originationUserUpdatedAt: originationUsers.updatedAt,
        closerUserId: clients.closerUserId,
        closerUserName: closerUsers.fullName,
        closerUserEmail: closerUsers.email,
        closerUserAvatarUrl: closerUsers.avatarUrl,
        closerUserUpdatedAt: closerUsers.updatedAt,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .leftJoin(contacts, eq(clients.originationContactId, contacts.id))
      .leftJoin(
        originationUsers,
        eq(clients.originationUserId, originationUsers.id)
      )
      .leftJoin(closerUsers, eq(clients.closerUserId, closerUsers.id))
      .where(and(...baseConditions))
      .orderBy(asc(clients.name))

    if (rows.length === 0) {
      return []
    }

    const clientIds = rows.map(r => r.id)

    // Fetch every non-deleted project per client (any status). The active
    // list is derived below — the definition of "active" (ACTIVE/ONBOARDING)
    // is unchanged; "total" is any status, deletedAt IS NULL.
    const [clientHours, projectsData, contactsByClient] = await Promise.all([
      getClientHoursTotals(db, clientIds),
      db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          status: projects.status,
          clientId: projects.clientId,
        })
        .from(projects)
        .where(
          and(inArray(projects.clientId, clientIds), isNull(projects.deletedAt))
        )
        .orderBy(asc(projects.name)),
      fetchContactSummariesByClient(clientIds),
    ])

    // Group projects by client ID
    const projectsMap = new Map<string, ClientProjectSummary[]>()
    for (const project of projectsData) {
      if (!project.clientId) continue
      const existing = projectsMap.get(project.clientId) ?? []
      existing.push({
        id: project.id,
        name: project.name,
        slug: project.slug,
        status: project.status,
      })
      projectsMap.set(project.clientId, existing)
    }

    return rows.map(row => {
      const {
        purchased: totalHoursPurchased,
        used: totalHoursUsed,
        remaining: hoursRemaining,
      } = clientHoursTotalsFor(clientHours, row.id)
      const allProjects = projectsMap.get(row.id) ?? []
      const activeProjects = allProjects.filter(
        project => project.status === 'ACTIVE' || project.status === 'ONBOARDING'
      )

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        notes: row.notes,
        website: row.website,
        billingType: row.billingType,
        state: row.state,
        originationContactId: row.originationContactId,
        originationContactName: row.originationContactName,
        originationUserId: row.originationUserId,
        originationUserName:
          row.originationUserName ?? row.originationUserEmail ?? null,
        originationUserAvatarUrl: row.originationUserAvatarUrl ?? null,
        originationUserUpdatedAt: row.originationUserUpdatedAt ?? null,
        closerUserId: row.closerUserId,
        closerUserName: row.closerUserName ?? row.closerUserEmail ?? null,
        closerUserAvatarUrl: row.closerUserAvatarUrl ?? null,
        closerUserUpdatedAt: row.closerUserUpdatedAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        projectCount: allProjects.length,
        activeProjectCount: activeProjects.length,
        activeProjects,
        allProjects,
        contacts: contactsByClient.get(row.id) ?? [],
        totalHoursPurchased,
        totalHoursUsed,
        hoursRemaining,
      }
    })
  }
)

/**
 * Name-ordered `{ id, slug }` directory of live clients — the prev/next
 * `ClientRecordCycle` needs exactly this and nothing more. It previously rode
 * on `fetchClientsWithMetrics`, which dragged the full hours/projects metrics
 * pipeline onto every client detail render.
 */
export const fetchClientCycleDirectory = cache(
  async (user: AppUser): Promise<Array<{ id: string; slug: string | null }>> => {
    assertAdmin(user)

    return db
      .select({ id: clients.id, slug: clients.slug })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.name))
  }
)

export type ClientHoursSummary = {
  id: string
  billingType: 'prepaid' | 'net_30'
  totalHoursPurchased: number
  hoursRemaining: number
}

/**
 * Billing type + prepaid burndown per live client — what the projects landing
 * hours badge needs. Only prepaid clients hit the time-log aggregate; net_30
 * clients render a flat badge with no totals.
 */
export const fetchClientHoursSummaries = cache(
  async (user: AppUser): Promise<ClientHoursSummary[]> => {
    assertAdmin(user)

    const rows = await db
      .select({ id: clients.id, billingType: clients.billingType })
      .from(clients)
      .where(isNull(clients.deletedAt))

    const prepaidIds = rows
      .filter(row => row.billingType === 'prepaid')
      .map(row => row.id)
    const clientHours = await getClientHoursTotals(db, prepaidIds)

    return rows.map(row => {
      const totals = clientHoursTotalsFor(clientHours, row.id)
      return {
        id: row.id,
        billingType: row.billingType,
        totalHoursPurchased: totals.purchased,
        hoursRemaining: totals.remaining,
      }
    })
  }
)

export const fetchClientById = cache(
  async (user: AppUser, clientId: string): Promise<ClientDetail> => {
    assertAdmin(user)

    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        notes: clients.notes,
        website: clients.website,
        state: clients.state,
        originationContactId: clients.originationContactId,
        originationUserId: clients.originationUserId,
        closerUserId: clients.closerUserId,
        billingType: clients.billingType,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
      .limit(1)

    if (!rows.length) {
      throw new NotFoundError('Client not found')
    }

    return rows[0]
  }
)

const fetchClientBySlug = cache(
  async (user: AppUser, slug: string): Promise<ClientDetail> => {
    const clientRow = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.slug, slug), isNull(clients.deletedAt)))
      .limit(1)

    if (!clientRow.length) {
      throw new NotFoundError('Client not found')
    }

    // Then check access and return full details
    return fetchClientById(user, clientRow[0].id)
  }
)

export type ClientProject = {
  id: string
  name: string
  slug: string | null
  status: string
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  startsOn: string | null
  endsOn: string | null
  totalTasks: number
  doneTasks: number
}

export const fetchProjectsForClient = cache(
  async (user: AppUser, clientId: string): Promise<ClientProject[]> => {
    assertAdmin(user)

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        type: projects.type,
        startsOn: projects.startsOn,
        endsOn: projects.endsOn,
      })
      .from(projects)
      .where(and(eq(projects.clientId, clientId), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name))

    // Fetch task counts for each project
    const projectIds = rows.map(r => r.id)

    if (projectIds.length === 0) {
      return []
    }

    const { tasks } = await import('@/lib/db/schema')

    const taskCounts = await db
      .select({
        projectId: tasks.projectId,
        total: sql<number>`count(*)`.as('total'),
        done: sql<number>`count(*) filter (where ${tasks.status} = 'DONE')`.as(
          'done'
        ),
      })
      .from(tasks)
      .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt)))
      .groupBy(tasks.projectId)

    const taskCountMap = new Map(
      taskCounts.map(tc => [tc.projectId, { total: tc.total, done: tc.done }])
    )

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      type: row.type,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      totalTasks: Number(taskCountMap.get(row.id)?.total ?? 0),
      doneTasks: Number(taskCountMap.get(row.id)?.done ?? 0),
    }))
  }
)
/**
 * Resolves a client identifier (slug or UUID) to the client record.
 * Returns the client detail if found, throws NotFoundError otherwise.
 */
export const resolveClientIdentifier = cache(
  async (
    user: AppUser,
    identifier: string
  ): Promise<ClientDetail & { resolvedId: string }> => {
    // Check if identifier looks like a UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      )

    let client: ClientDetail

    if (isUUID) {
      client = await fetchClientById(user, identifier)
    } else {
      client = await fetchClientBySlug(user, identifier)
    }

    return { ...client, resolvedId: client.id }
  }
)
