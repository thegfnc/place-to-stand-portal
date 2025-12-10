import 'server-only'

import { and, desc, eq, isNull, isNotNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  isAdmin,
  listAccessibleClientIds,
  listAccessibleProjectIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'
import { ActivityVerbs } from '@/lib/activity/types'
import { fetchProjectsWithRelationsByIds } from '@/lib/data/projects'
import type { ProjectWithRelations } from '@/lib/types'
import { fetchClientsByIds } from '@/lib/data/clients'

const DEFAULT_LIMIT = 5
const RECENT_SCAN_LIMIT = 200

export type RecentlyViewedProject = {
  id: string
  name: string
  clientName: string | null
  href: string
  touchedAt: string
}

export type RecentlyViewedClient = {
  id: string
  name: string
  href: string
  touchedAt: string
}

export async function fetchRecentlyViewedProjects(
  user: AppUser,
  limit = DEFAULT_LIMIT
): Promise<RecentlyViewedProject[]> {
  const normalizedLimit = Math.max(0, Math.min(limit, DEFAULT_LIMIT * 2))
  if (!normalizedLimit) {
    return []
  }

  const accessibleProjectIds = isAdmin(user)
    ? null
    : await listAccessibleProjectIds(user)

  if (accessibleProjectIds !== null && accessibleProjectIds.length === 0) {
    return []
  }

  const rows = await db
    .select({
      projectId: activityLogs.targetProjectId,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.actorId, user.id),
        eq(activityLogs.verb, ActivityVerbs.PROJECT_VIEWED),
        isNull(activityLogs.deletedAt),
        isNotNull(activityLogs.targetProjectId)
      )
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(RECENT_SCAN_LIMIT)

  const allowedProjects = accessibleProjectIds
    ? new Set(accessibleProjectIds)
    : null
  const deduped: Array<{ projectId: string; createdAt: string }> = []
  const seen = new Set<string>()

  for (const row of rows) {
    if (!row.projectId) {
      continue
    }
    if (allowedProjects && !allowedProjects.has(row.projectId)) {
      continue
    }
    if (seen.has(row.projectId)) {
      continue
    }
    seen.add(row.projectId)
    deduped.push({ projectId: row.projectId, createdAt: row.createdAt })
    if (deduped.length >= normalizedLimit) {
      break
    }
  }

  if (!deduped.length) {
    return []
  }

  const projects = await fetchProjectsWithRelationsByIds(
    deduped.map(item => item.projectId)
  )
  const lookup = new Map(projects.map(project => [project.id, project]))

  return deduped
    .map(item => {
      const project = lookup.get(item.projectId)
      if (!project) {
        return null
      }

      return {
        id: project.id,
        name: project.name,
        clientName: resolveClientName(project),
        href: buildProjectHref(project),
        touchedAt: item.createdAt,
      }
    })
    .filter((entry): entry is RecentlyViewedProject => Boolean(entry))
}

export async function fetchRecentlyViewedClients(
  user: AppUser,
  limit = DEFAULT_LIMIT
): Promise<RecentlyViewedClient[]> {
  const normalizedLimit = Math.max(0, Math.min(limit, DEFAULT_LIMIT * 2))
  if (!normalizedLimit) {
    return []
  }

  const accessibleClientIds = isAdmin(user)
    ? null
    : await listAccessibleClientIds(user)

  if (accessibleClientIds !== null && accessibleClientIds.length === 0) {
    return []
  }

  const rows = await db
    .select({
      clientId: activityLogs.targetClientId,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.actorId, user.id),
        eq(activityLogs.verb, ActivityVerbs.CLIENT_VIEWED),
        isNull(activityLogs.deletedAt),
        isNotNull(activityLogs.targetClientId)
      )
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(RECENT_SCAN_LIMIT)

  const allowedClients = accessibleClientIds
    ? new Set(accessibleClientIds)
    : null
  const deduped: Array<{ clientId: string; createdAt: string }> = []
  const seen = new Set<string>()

  for (const row of rows) {
    if (!row.clientId) {
      continue
    }
    if (allowedClients && !allowedClients.has(row.clientId)) {
      continue
    }
    if (seen.has(row.clientId)) {
      continue
    }
    seen.add(row.clientId)
    deduped.push({ clientId: row.clientId, createdAt: row.createdAt })
    if (deduped.length >= normalizedLimit) {
      break
    }
  }

  if (!deduped.length) {
    return []
  }

  const clients = await fetchClientsByIds(deduped.map(item => item.clientId))
  const lookup = new Map(clients.map(client => [client.id, client]))

  return deduped
    .map(item => {
      const client = lookup.get(item.clientId)
      if (!client) {
        return null
      }
      return {
        id: client.id,
        name: client.name,
        href: buildClientHref(client),
        touchedAt: item.createdAt,
      }
    })
    .filter((entry): entry is RecentlyViewedClient => Boolean(entry))
}

function resolveClientName(project: ProjectWithRelations): string | null {
  if (project.type === 'INTERNAL') {
    return 'Internal'
  }
  if (project.type === 'PERSONAL') {
    return 'Personal'
  }
  return project.client?.name ?? null
}

function buildProjectHref(project: ProjectWithRelations): string {
  const projectSegment = project.slug ?? project.id
  let clientSegment: string

  if (project.type === 'INTERNAL') {
    clientSegment = 'internal'
  } else if (project.type === 'PERSONAL') {
    clientSegment = 'personal'
  } else if (project.client?.slug) {
    clientSegment = project.client.slug
  } else if (project.client_id) {
    clientSegment = project.client_id
  } else {
    clientSegment = project.id
  }

  return `/projects/${clientSegment}/${projectSegment}/board`
}

function buildClientHref(client: { id: string; slug: string | null }) {
  return `/clients/${client.slug ?? client.id}`
}
