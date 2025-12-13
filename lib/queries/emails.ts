import 'server-only'

import { and, eq, isNull, inArray } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { emailLinks, emailMetadata } from '@/lib/db/schema'
import {
  ensureClientAccess,
  ensureClientAccessByProjectId,
  isAdmin,
} from '@/lib/auth/permissions'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'

export async function getEmailMetadataById(user: AppUser, id: string) {
  const rows = await db
    .select()
    .from(emailMetadata)
    .where(and(eq(emailMetadata.id, id), isNull(emailMetadata.deletedAt)))
    .limit(1)

  const record = rows[0] ?? null
  if (!record) return null

  // Users may only access their own email metadata unless admin
  if (!isAdmin(user) && record.userId !== user.id) {
    throw new ForbiddenError('Insufficient permissions to access email')
  }

  return record
}

export async function listEmailLinksForEmail(user: AppUser, emailId: string) {
  const email = await getEmailMetadataById(user, emailId)
  if (!email) throw new NotFoundError('Email not found')

  const rows = await db
    .select()
    .from(emailLinks)
    .where(and(eq(emailLinks.emailMetadataId, email.id), isNull(emailLinks.deletedAt)))

  return rows
}

export type CreateEmailLinkInput = {
  emailMetadataId: string
  clientId?: string | null
  projectId?: string | null
  source: 'MANUAL_LINK' | 'MANUAL_FORWARD' | 'AUTOMATIC'
  confidence?: number | null
  notes?: string | null
}

export async function createEmailLink(user: AppUser, input: CreateEmailLinkInput) {
  const email = await getEmailMetadataById(user, input.emailMetadataId)
  if (!email) throw new NotFoundError('Email not found')

  // Validate at least one target
  if (!input.clientId && !input.projectId) {
    throw new ForbiddenError('Link must include clientId or projectId')
  }

  if (input.clientId) {
    await ensureClientAccess(user, input.clientId)
  }
  if (input.projectId) {
    await ensureClientAccessByProjectId(user, input.projectId)
  }

  const [inserted] = await db
    .insert(emailLinks)
    .values({
      emailMetadataId: email.id,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      source: input.source,
      confidence:
        typeof input.confidence === 'number'
          ? input.confidence.toString()
          : null,
      linkedBy: input.source === 'AUTOMATIC' ? null : user.id,
      notes: input.notes ?? null,
    })
    .returning()

  return inserted
}

export async function deleteEmailLink(user: AppUser, linkId: string) {
  // Load link + email to check ownership and access
  const rows = await db
    .select({
      id: emailLinks.id,
      emailMetadataId: emailLinks.emailMetadataId,
      clientId: emailLinks.clientId,
      projectId: emailLinks.projectId,
    })
    .from(emailLinks)
    .where(and(eq(emailLinks.id, linkId), isNull(emailLinks.deletedAt)))
    .limit(1)

  const link = rows[0]
  if (!link) throw new NotFoundError('Link not found')

  const email = await getEmailMetadataById(user, link.emailMetadataId)
  if (!email) throw new NotFoundError('Email not found')

  if (link.clientId) {
    await ensureClientAccess(user, link.clientId)
  }
  if (link.projectId) {
    await ensureClientAccessByProjectId(user, link.projectId)
  }

  const [deleted] = await db
    .update(emailLinks)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(emailLinks.id, linkId))
    .returning()

  return deleted
}

export type MinimalEmailDirectoryFilters = {
  clientIds?: string[]
  projectIds?: string[]
  limit?: number
}

export async function listEmailMetadataForDirectory(
  user: AppUser,
  filters: MinimalEmailDirectoryFilters = {}
) {
  // Only own emails unless admin
  const userFilter = isAdmin(user)
    ? undefined
    : eq(emailMetadata.userId, user.id)

  // Optional: filter by linked client/project
  if (filters.clientIds?.length || filters.projectIds?.length) {
    const linkRows = await db
      .select({
        emailId: emailLinks.emailMetadataId,
        clientId: emailLinks.clientId,
        projectId: emailLinks.projectId,
      })
      .from(emailLinks)
      .where(
        and(
          isNull(emailLinks.deletedAt),
          filters.clientIds?.length ? inArray(emailLinks.clientId, filters.clientIds) : undefined,
          filters.projectIds?.length ? inArray(emailLinks.projectId, filters.projectIds) : undefined,
        )
      )

    const emailIds = [...new Set(linkRows.map(r => r.emailId))]
    if (!emailIds.length) return []

    const emails = await db
      .select()
      .from(emailMetadata)
      .where(and(inArray(emailMetadata.id, emailIds), isNull(emailMetadata.deletedAt), userFilter))
      .limit(filters.limit ?? 50)

    return emails
  }

  const emails = await db
    .select()
    .from(emailMetadata)
    .where(and(isNull(emailMetadata.deletedAt), userFilter))
    .limit(filters.limit ?? 50)

  return emails
}
