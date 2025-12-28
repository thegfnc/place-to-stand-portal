import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { threads } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const user = await requireUser()
  const { linkId } = await params

  try {
    // In the new schema, linkId is actually threadId
    const [thread] = await db
      .select()
      .from(threads)
      .where(eq(threads.id, linkId))
      .limit(1)

    if (!thread) throw new NotFoundError('Thread not found')

    // Permission check - only admin or thread creator can unlink
    if (!isAdmin(user) && thread.createdBy !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // Clear the client/project links from the thread
    const [updated] = await db
      .update(threads)
      .set({
        clientId: null,
        projectId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(threads.id, linkId))
      .returning()

    return NextResponse.json({
      ok: true,
      deleted: {
        id: updated.id,
        clientId: null,
        projectId: null,
      },
    })
  } catch (err) {
    const error = err as HttpError
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
