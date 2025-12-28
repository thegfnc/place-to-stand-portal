import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, notInArray } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, clientContacts, projects, messages, threads } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'
import { matchEmailToClients } from '@/lib/ai/email-client-matching'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ emailId: string }> }) {
  const user = await requireUser()
  const { emailId } = await params

  try {
    // Get the message with its thread
    const [result] = await db
      .select({
        message: messages,
        thread: threads,
      })
      .from(messages)
      .leftJoin(threads, eq(threads.id, messages.threadId))
      .where(and(eq(messages.id, emailId), isNull(messages.deletedAt)))
      .limit(1)

    if (!result?.message) throw new NotFoundError('Message not found')
    const message = result.message
    const thread = result.thread

    if (!isAdmin(user) && message.userId !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // Get already-linked client from thread
    const linkedClientIds = thread?.clientId ? [thread.clientId] : []

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

    // Use AI to match message to clients
    const { matches } = await matchEmailToClients({
      email: {
        from: message.fromEmail,
        to: message.toEmails ?? [],
        cc: message.ccEmails ?? [],
        subject: message.subject,
        snippet: message.snippet,
      },
      clients: clientsWithData,
    })

    // Transform AI matches to suggestion format
    const suggestions = matches.map(match => ({
      clientId: match.clientId,
      clientName: match.clientName,
      confidence: match.confidence,
      matchedContacts: [],
      reasoning: match.reasoning,
      matchType: match.matchType,
    }))

    return NextResponse.json({ ok: true, suggestions })
  } catch (err) {
    const error = err as HttpError
    console.error('Message suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
