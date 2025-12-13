import 'server-only'

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clientContacts, emailLinks, emailMetadata } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { isAdmin } from '@/lib/auth/permissions'

function normalize(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase()
}

function domain(email: string) {
  const idx = email.indexOf('@')
  return idx >= 0 ? email.slice(idx + 1) : ''
}

export type MatchResult = {
  createdLinkIds: string[]
}

/**
 * Match an email against client contacts via exact email and domain heuristics.
 * Inserts email_links with source=AUTOMATIC and confidence scores.
 */
export async function matchAndLinkEmail(
  user: AppUser,
  emailId: string
): Promise<MatchResult> {
  const rows = await db
    .select()
    .from(emailMetadata)
    .where(and(eq(emailMetadata.id, emailId), isNull(emailMetadata.deletedAt)))
    .limit(1)

  const email = rows[0]
  if (!email) throw new NotFoundError('Email not found')

  if (!isAdmin(user) && email.userId !== user.id) {
    throw new ForbiddenError('Insufficient permissions to match email')
  }

  const from = normalize(email.fromEmail)
  const tos = (email.toEmails ?? []).map(normalize)
  const ccs = (email.ccEmails ?? []).map(normalize)
  const allAddresses = Array.from(new Set([from, ...tos, ...ccs].filter(Boolean)))

  const addressDomains = Array.from(new Set(allAddresses.map(domain).filter(Boolean)))

  // Find contacts that match any address or any domain
  const contacts = await db
    .select({ id: clientContacts.id, clientId: clientContacts.clientId, email: clientContacts.email })
    .from(clientContacts)
    .where(
      and(
        isNull(clientContacts.deletedAt),
        // match exact emails OR any domain match
        sql`${clientContacts.email} = ANY(${allAddresses}) OR split_part(${clientContacts.email}, '@', 2) = ANY(${addressDomains})`
      )
    )

  if (!contacts.length) {
    return { createdLinkIds: [] }
  }

  // De-dupe clients
  const clientIds = Array.from(new Set(contacts.map(c => c.clientId)))

  // Avoid duplicates: fetch existing links for this email+clients
  const existing = await db
    .select({ clientId: emailLinks.clientId, id: emailLinks.id })
    .from(emailLinks)
    .where(
      and(
        eq(emailLinks.emailMetadataId, email.id),
        isNull(emailLinks.deletedAt),
        inArray(emailLinks.clientId, clientIds)
      )
    )

  const existingClientIds = new Set(existing.map(e => e.clientId).filter(Boolean) as string[])
  const toCreate = clientIds.filter(id => !existingClientIds.has(id))

  if (!toCreate.length) return { createdLinkIds: [] }

  const created = await db
    .insert(emailLinks)
    .values(
      toCreate.map(clientId => ({
        emailMetadataId: email.id,
        clientId,
        projectId: null,
        source: 'AUTOMATIC' as const,
        confidence: contacts.some(c => c.clientId === clientId && normalize(c.email) === from)
          ? '1.00'
          : '0.60',
        linkedBy: null,
        notes: null,
      }))
    )
    .returning({ id: emailLinks.id })

  return { createdLinkIds: created.map(c => c.id) }
}
