import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { messages, threads, clients } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'

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

    if (!isAdmin(user) && result.message.userId !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // In the new schema, the link is on the thread itself
    const links: { clientId: string; clientName: string }[] = []

    if (result.thread?.clientId) {
      const [client] = await db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(eq(clients.id, result.thread.clientId))
        .limit(1)

      if (client) {
        links.push({
          clientId: client.id,
          clientName: client.name,
        })
      }
    }

    return NextResponse.json({ ok: true, links })
  } catch (err) {
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
