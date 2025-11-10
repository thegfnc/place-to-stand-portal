import 'server-only'

import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'

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

type ProjectSettingsSnapshot = {
  projects: Array<typeof projects.$inferSelect>
  clients: Array<{
    id: string
    name: string
    deletedAt: string | null
  }>
}

export async function getProjectsSettingsSnapshot(
  user: AppUser
): Promise<ProjectSettingsSnapshot> {
  assertAdmin(user)

  const [projectRows, clientRows] = await Promise.all([
    db
      .select({
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
      })
      .from(projects)
      .orderBy(asc(projects.name)),
    db
      .select({
        id: clients.id,
        name: clients.name,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .orderBy(asc(clients.name)),
  ])

  return {
    projects: projectRows,
    clients: clientRows,
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
