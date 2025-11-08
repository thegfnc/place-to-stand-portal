import 'server-only'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureClientAccess,
  ensureClientAccessByProjectId,
  isAdmin,
  listAccessibleProjectIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
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
