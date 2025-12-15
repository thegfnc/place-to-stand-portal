import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, sql, notInArray } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientContacts, clients, emailLinks, emailMetadata } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'

function normalize(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase()
}

function domain(email: string) {
  const idx = email.indexOf('@')
  return idx >= 0 ? email.slice(idx + 1) : ''
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ emailId: string }> }) {
  const user = await requireUser()
  const { emailId } = await params

  try {
    // Get the email
    const [email] = await db
      .select()
      .from(emailMetadata)
      .where(and(eq(emailMetadata.id, emailId), isNull(emailMetadata.deletedAt)))
      .limit(1)

    if (!email) throw new NotFoundError('Email not found')
    if (!isAdmin(user) && email.userId !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // Extract addresses
    const from = normalize(email.fromEmail)
    const tos = (email.toEmails ?? []).map(normalize)
    const ccs = (email.ccEmails ?? []).map(normalize)
    const allAddresses = Array.from(new Set([from, ...tos, ...ccs].filter(Boolean)))
    const addressDomains = Array.from(new Set(allAddresses.map(domain).filter(Boolean)))

    // Get already-linked client IDs
    const existingLinks = await db
      .select({ clientId: emailLinks.clientId })
      .from(emailLinks)
      .where(and(eq(emailLinks.emailMetadataId, emailId), isNull(emailLinks.deletedAt)))

    const linkedClientIds = existingLinks.map(l => l.clientId).filter(Boolean) as string[]

    // Find matching contacts (not already linked)
    const matchQuery = db
      .select({
        clientId: clientContacts.clientId,
        clientName: clients.name,
        contactEmail: clientContacts.email,
        contactName: clientContacts.name,
      })
      .from(clientContacts)
      .innerJoin(clients, eq(clients.id, clientContacts.clientId))
      .where(
        and(
          isNull(clientContacts.deletedAt),
          isNull(clients.deletedAt),
          sql`(${clientContacts.email} = ANY(${allAddresses}) OR split_part(${clientContacts.email}, '@', 2) = ANY(${addressDomains}))`,
          linkedClientIds.length > 0
            ? notInArray(clientContacts.clientId, linkedClientIds)
            : undefined
        )
      )

    const matches = await matchQuery

    // Group by client and compute confidence
    const clientMap = new Map<string, { clientId: string; clientName: string; confidence: number; matchedContacts: string[] }>()

    for (const m of matches) {
      const existing = clientMap.get(m.clientId)
      const isExact = allAddresses.includes(normalize(m.contactEmail))
      const confidence = isExact ? 1.0 : 0.6

      if (!existing) {
        clientMap.set(m.clientId, {
          clientId: m.clientId,
          clientName: m.clientName,
          confidence,
          matchedContacts: [m.contactEmail],
        })
      } else {
        existing.confidence = Math.max(existing.confidence, confidence)
        if (!existing.matchedContacts.includes(m.contactEmail)) {
          existing.matchedContacts.push(m.contactEmail)
        }
      }
    }

    const suggestions = Array.from(clientMap.values()).sort((a, b) => b.confidence - a.confidence)

    return NextResponse.json({ ok: true, suggestions })
  } catch (err) {
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
