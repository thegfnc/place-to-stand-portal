import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { messages, threads } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'

export async function POST(req: NextRequest) {
  const user = await requireUser()

  try {
    const body = (await req.json()) as {
      messageId: string  // Was emailMetadataId
      clientId?: string | null
      projectId?: string | null
    }

    // Get the message with its thread
    const [result] = await db
      .select({
        message: messages,
        thread: threads,
      })
      .from(messages)
      .leftJoin(threads, eq(threads.id, messages.threadId))
      .where(and(eq(messages.id, body.messageId), isNull(messages.deletedAt)))
      .limit(1)

    if (!result?.message) throw new NotFoundError('Message not found')

    if (!isAdmin(user) && result.message.userId !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    if (!result.thread) {
      throw new NotFoundError('Thread not found for message')
    }

    // Update the thread's client/project link
    const [updated] = await db
      .update(threads)
      .set({
        clientId: body.clientId ?? null,
        projectId: body.projectId ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(threads.id, result.thread.id))
      .returning()

    console.log('[Thread Link] Updated thread:', {
      threadId: updated.id,
      clientId: body.clientId,
      userId: user.id,
    })

    return NextResponse.json({
      ok: true,
      link: {
        id: updated.id,
        threadId: updated.id,
        clientId: updated.clientId,
        projectId: updated.projectId,
      },
    })
  } catch (err) {
    console.error('[Thread Link] Error:', err)
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
