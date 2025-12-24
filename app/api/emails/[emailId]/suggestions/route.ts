import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, notInArray } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, clientContacts, projects, emailLinks, emailMetadata } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'
import { matchEmailToClients } from '@/lib/ai/email-client-matching'

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

    // Get already-linked client IDs
    const existingLinks = await db
      .select({ clientId: emailLinks.clientId })
      .from(emailLinks)
      .where(and(eq(emailLinks.emailMetadataId, emailId), isNull(emailLinks.deletedAt)))

    const linkedClientIds = existingLinks.map(l => l.clientId).filter(Boolean) as string[]

    // Fetch all clients with their contacts and projects
    const allClients = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .where(
        and(
          isNull(clients.deletedAt),
          linkedClientIds.length > 0
            ? notInArray(clients.id, linkedClientIds)
            : undefined
        )
      )

    if (allClients.length === 0) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Fetch contacts for each client
    const allContacts = await db
      .select({
        clientId: clientContacts.clientId,
        email: clientContacts.email,
        name: clientContacts.name,
      })
      .from(clientContacts)
      .where(isNull(clientContacts.deletedAt))

    // Fetch projects for each client
    const allProjects = await db
      .select({
        clientId: projects.clientId,
        name: projects.name,
      })
      .from(projects)
      .where(and(isNull(projects.deletedAt), eq(projects.type, 'CLIENT')))

    // Group contacts and projects by client
    const clientsWithData = allClients.map(client => ({
      id: client.id,
      name: client.name,
      contacts: allContacts
        .filter(c => c.clientId === client.id)
        .map(c => ({ email: c.email, name: c.name })),
      projects: allProjects
        .filter(p => p.clientId === client.id)
        .map(p => ({ name: p.name })),
    }))

    // Use AI to match email to clients
    const { matches } = await matchEmailToClients({
      email: {
        from: email.fromEmail,
        to: email.toEmails ?? [],
        cc: email.ccEmails ?? [],
        subject: email.subject,
        snippet: email.snippet,
      },
      clients: clientsWithData,
    })

    // Transform AI matches to suggestion format
    const suggestions = matches.map(match => ({
      clientId: match.clientId,
      clientName: match.clientName,
      confidence: match.confidence,
      matchedContacts: [], // AI doesn't return specific contacts, could enhance later
      reasoning: match.reasoning,
      matchType: match.matchType,
    }))

    return NextResponse.json({ ok: true, suggestions })
  } catch (err) {
    const error = err as HttpError
    console.error('Email suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
