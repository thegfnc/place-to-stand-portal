import 'server-only'

import { and, desc, eq, isNull, inArray } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, emailLinks, emailMetadata, projects } from '@/lib/db/schema'
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

// ─────────────────────────────────────────────────────────────────────────────
// Emails with Links (for UI)
// ─────────────────────────────────────────────────────────────────────────────

export type EmailWithLinks = {
  id: string
  subject: string | null
  snippet: string | null
  fromEmail: string
  fromName: string | null
  toEmails: string[]
  ccEmails: string[]
  receivedAt: string
  isRead: boolean
  hasAttachments: boolean
  links: Array<{
    id: string
    source: string
    confidence: string | null
    client: { id: string; name: string } | null
    project: { id: string; name: string } | null
  }>
}

export async function getEmailsWithLinks(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<EmailWithLinks[]> {
  const { limit = 50, offset = 0 } = options

  // Fetch emails
  const emails = await db
    .select()
    .from(emailMetadata)
    .where(and(eq(emailMetadata.userId, userId), isNull(emailMetadata.deletedAt)))
    .orderBy(desc(emailMetadata.receivedAt))
    .limit(limit)
    .offset(offset)

  if (emails.length === 0) return []

  const emailIds = emails.map(e => e.id)

  // Fetch all links for these emails
  const links = await db
    .select({
      id: emailLinks.id,
      emailMetadataId: emailLinks.emailMetadataId,
      clientId: emailLinks.clientId,
      projectId: emailLinks.projectId,
      source: emailLinks.source,
      confidence: emailLinks.confidence,
    })
    .from(emailLinks)
    .where(and(inArray(emailLinks.emailMetadataId, emailIds), isNull(emailLinks.deletedAt)))

  // Fetch client/project names
  const clientIds = [...new Set(links.map(l => l.clientId).filter(Boolean))] as string[]
  const projectIds = [...new Set(links.map(l => l.projectId).filter(Boolean))] as string[]

  const [clientRows, projectRows] = await Promise.all([
    clientIds.length > 0
      ? db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
      : [],
    projectIds.length > 0
      ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
      : [],
  ])

  const clientMap = new Map(clientRows.map(c => [c.id, c]))
  const projectMap = new Map(projectRows.map(p => [p.id, p]))

  // Build the result
  return emails.map(email => ({
    id: email.id,
    subject: email.subject,
    snippet: email.snippet,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    toEmails: email.toEmails,
    ccEmails: email.ccEmails,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    hasAttachments: email.hasAttachments,
    links: links
      .filter(l => l.emailMetadataId === email.id)
      .map(l => ({
        id: l.id,
        source: l.source,
        confidence: l.confidence,
        client: l.clientId ? clientMap.get(l.clientId) ?? null : null,
        project: l.projectId ? projectMap.get(l.projectId) ?? null : null,
      })),
  }))
}

export type LinkedEmailForClient = {
  id: string
  subject: string | null
  fromEmail: string
  fromName: string | null
  receivedAt: string
  source: string
}

export async function getLinkedEmailsForClient(clientId: string, limit = 20): Promise<LinkedEmailForClient[]> {
  const rows = await db
    .select({
      id: emailMetadata.id,
      subject: emailMetadata.subject,
      fromEmail: emailMetadata.fromEmail,
      fromName: emailMetadata.fromName,
      receivedAt: emailMetadata.receivedAt,
      source: emailLinks.source,
    })
    .from(emailLinks)
    .innerJoin(emailMetadata, eq(emailMetadata.id, emailLinks.emailMetadataId))
    .where(and(eq(emailLinks.clientId, clientId), isNull(emailLinks.deletedAt), isNull(emailMetadata.deletedAt)))
    .orderBy(desc(emailMetadata.receivedAt))
    .limit(limit)

  return rows
}

export async function getEmailWithLinksById(userId: string, emailId: string): Promise<EmailWithLinks | null> {
  const results = await getEmailsWithLinks(userId, { limit: 1 })

  // Need to fetch specific email
  const [email] = await db
    .select()
    .from(emailMetadata)
    .where(and(eq(emailMetadata.id, emailId), eq(emailMetadata.userId, userId), isNull(emailMetadata.deletedAt)))
    .limit(1)

  if (!email) return null

  // Get links
  const links = await db
    .select({
      id: emailLinks.id,
      clientId: emailLinks.clientId,
      projectId: emailLinks.projectId,
      source: emailLinks.source,
      confidence: emailLinks.confidence,
    })
    .from(emailLinks)
    .where(and(eq(emailLinks.emailMetadataId, emailId), isNull(emailLinks.deletedAt)))

  const clientIds = links.map(l => l.clientId).filter(Boolean) as string[]
  const projectIds = links.map(l => l.projectId).filter(Boolean) as string[]

  const [clientRows, projectRows] = await Promise.all([
    clientIds.length > 0
      ? db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
      : [],
    projectIds.length > 0
      ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
      : [],
  ])

  const clientMap = new Map(clientRows.map(c => [c.id, c]))
  const projectMap = new Map(projectRows.map(p => [p.id, p]))

  return {
    id: email.id,
    subject: email.subject,
    snippet: email.snippet,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    toEmails: email.toEmails,
    ccEmails: email.ccEmails,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    hasAttachments: email.hasAttachments,
    links: links.map(l => ({
      id: l.id,
      source: l.source,
      confidence: l.confidence,
      client: l.clientId ? clientMap.get(l.clientId) ?? null : null,
      project: l.projectId ? projectMap.get(l.projectId) ?? null : null,
    })),
  }
}
