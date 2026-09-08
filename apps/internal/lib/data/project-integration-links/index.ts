import { and, eq, inArray, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import { projectIntegrationLinks } from '@/lib/db/schema'
import {
  INTEGRATION_PROVIDERS,
  type ExternalProjectOption,
  type ProjectIntegrationLink,
} from '@/lib/types/integrations'

export async function getProjectIntegrationLinks(
  projectId: string
): Promise<ProjectIntegrationLink[]> {
  return db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        eq(projectIntegrationLinks.projectId, projectId),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )
    .orderBy(projectIntegrationLinks.provider, projectIntegrationLinks.createdAt)
}

/** Batch fetch for list pages — one query for every project on screen. */
export async function getIntegrationLinksForProjects(
  projectIds: string[]
): Promise<Map<string, ProjectIntegrationLink[]>> {
  if (projectIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        inArray(projectIntegrationLinks.projectId, projectIds),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )
    .orderBy(projectIntegrationLinks.provider, projectIntegrationLinks.createdAt)

  const linksByProject = new Map<string, ProjectIntegrationLink[]>()
  rows.forEach(row => {
    const existing = linksByProject.get(row.projectId) ?? []
    existing.push(row)
    linksByProject.set(row.projectId, existing)
  })

  return linksByProject
}

export async function getIntegrationLinkById(
  linkId: string
): Promise<ProjectIntegrationLink | null> {
  const [link] = await db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        eq(projectIntegrationLinks.id, linkId),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )
    .limit(1)

  return link ?? null
}

/**
 * Links an external project. A previously unlinked row for the same
 * external project is restored (and refreshed) rather than duplicated, so
 * the unique constraint on (project, provider, external id) never trips.
 */
export async function linkExternalProject(
  projectId: string,
  option: ExternalProjectOption,
  userId: string
): Promise<ProjectIntegrationLink> {
  const now = new Date().toISOString()
  const details = {
    externalName: option.externalName,
    ownerId: option.ownerId,
    ownerSlug: option.ownerSlug,
    ownerName: option.ownerName,
    url: option.url,
    metadata: option.metadata,
  }

  const [existing] = await db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        eq(projectIntegrationLinks.projectId, projectId),
        eq(projectIntegrationLinks.provider, option.provider),
        eq(projectIntegrationLinks.externalId, option.externalId)
      )
    )
    .limit(1)

  if (existing && !existing.deletedAt) {
    return existing
  }

  let link: ProjectIntegrationLink
  if (existing) {
    const [restored] = await db
      .update(projectIntegrationLinks)
      .set({ ...details, linkedBy: userId, updatedAt: now, deletedAt: null })
      .where(eq(projectIntegrationLinks.id, existing.id))
      .returning()
    link = restored
  } else {
    const [inserted] = await db
      .insert(projectIntegrationLinks)
      .values({
        projectId,
        provider: option.provider,
        externalId: option.externalId,
        ...details,
        linkedBy: userId,
      })
      .returning()
    link = inserted
  }

  await logActivity({
    actorId: userId,
    verb: 'INTEGRATION_PROJECT_LINKED',
    summary: `Linked ${INTEGRATION_PROVIDERS[option.provider].label} project ${option.externalName}`,
    targetType: 'PROJECT',
    targetId: projectId,
    targetProjectId: projectId,
    metadata: {
      provider: option.provider,
      externalId: option.externalId,
      externalName: option.externalName,
      ownerName: option.ownerName,
    },
  })

  return link
}

export async function unlinkExternalProject(
  link: ProjectIntegrationLink,
  userId: string
): Promise<void> {
  const now = new Date().toISOString()

  await db
    .update(projectIntegrationLinks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(projectIntegrationLinks.id, link.id))

  await logActivity({
    actorId: userId,
    verb: 'INTEGRATION_PROJECT_UNLINKED',
    summary: `Unlinked ${INTEGRATION_PROVIDERS[link.provider].label} project ${link.externalName}`,
    targetType: 'PROJECT',
    targetId: link.projectId,
    targetProjectId: link.projectId,
    metadata: {
      provider: link.provider,
      externalId: link.externalId,
      externalName: link.externalName,
    },
  })
}
