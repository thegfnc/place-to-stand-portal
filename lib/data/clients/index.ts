import 'server-only'

import { cache } from 'react'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  isAdmin,
  listAccessibleClientIds,
  ensureClientAccess,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

export type ClientWithMetrics = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  billingType: 'prepaid' | 'net_30'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  projectCount: number
  activeProjectCount: number
}

export type ClientDetail = {
  id: string
  name: string
  slug: string | null
  notes: string | null
  billingType: 'prepaid' | 'net_30'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export const fetchClientsWithMetrics = cache(
  async (user: AppUser): Promise<ClientWithMetrics[]> => {
    const baseConditions = [isNull(clients.deletedAt)]

    if (!isAdmin(user)) {
      const clientIds = await listAccessibleClientIds(user)
      if (!clientIds.length) {
        return []
      }
      baseConditions.push(inArray(clients.id, clientIds))
    }

    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        notes: clients.notes,
        billingType: clients.billingType,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        deletedAt: clients.deletedAt,
        projectCount: sql<number>`
          count(${projects.id}) filter (where ${projects.deletedAt} is null)
        `.as('project_count'),
        activeProjectCount: sql<number>`
          count(${projects.id}) filter (
            where ${projects.deletedAt} is null
            and lower(${projects.status}) = 'active'
          )
        `.as('active_project_count'),
      })
      .from(clients)
      .leftJoin(projects, eq(projects.clientId, clients.id))
      .where(and(...baseConditions))
      .groupBy(
        clients.id,
        clients.name,
        clients.slug,
        clients.notes,
        clients.billingType,
        clients.createdAt,
        clients.updatedAt,
        clients.deletedAt
      )
      .orderBy(asc(clients.name))

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      notes: row.notes,
      billingType: row.billingType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      projectCount: Number(row.projectCount ?? 0),
      activeProjectCount: Number(row.activeProjectCount ?? 0),
    }))
  }
)

export const fetchClientById = cache(
  async (user: AppUser, clientId: string): Promise<ClientDetail> => {
    await ensureClientAccess(user, clientId)

    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        notes: clients.notes,
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

export const fetchClientBySlug = cache(
  async (user: AppUser, slug: string): Promise<ClientDetail> => {
    // First, find the client by slug
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
    await ensureClientAccess(user, clientId)

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
        total:
          sql<number>`count(*) filter (where ${tasks.status} != 'ARCHIVED')`.as(
            'total'
          ),
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

export async function fetchClientsByIds(
  clientIds: string[]
): Promise<ClientDetail[]> {
  if (!clientIds.length) {
    return []
  }

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
      notes: clients.notes,
      billingType: clients.billingType,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      deletedAt: clients.deletedAt,
    })
    .from(clients)
    .where(and(inArray(clients.id, clientIds), isNull(clients.deletedAt)))

  const lookup = new Map(rows.map(row => [row.id, row]))

  return clientIds
    .map(id => lookup.get(id))
    .filter((row): row is ClientDetail => Boolean(row))
}

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
