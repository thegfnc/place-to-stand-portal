import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, desc } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, clientContacts, projects, messages, threads } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'
import { matchEmailToClients } from '@/lib/ai/email-client-matching'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await requireUser()
  const { threadId } = await params

  try {
    // Get the thread
    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
      .limit(1)

    if (!thread) throw new NotFoundError('Thread not found')

    if (!isAdmin(user) && thread.createdBy !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // If thread already has a client, return empty suggestions
    if (thread.clientId) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Get the latest message in the thread for analysis
    const [latestMessage] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.threadId, threadId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.sentAt))
      .limit(1)

    if (!latestMessage) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Fetch all clients
    const allClients = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .where(isNull(clients.deletedAt))

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

    // Use AI to match thread to clients based on latest message
    const { matches } = await matchEmailToClients({
      email: {
        from: latestMessage.fromEmail,
        to: latestMessage.toEmails ?? [],
        cc: latestMessage.ccEmails ?? [],
        subject: latestMessage.subject ?? thread.subject,
        snippet: latestMessage.snippet,
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
    console.error('Thread suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
