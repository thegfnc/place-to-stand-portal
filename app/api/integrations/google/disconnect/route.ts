import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'
import { revokeToken } from '@/lib/oauth/google'
import { logActivity } from '@/lib/activity/logger'

export async function POST(request: Request) {
  const user = await requireUser()

  // Get connectionId from request body (multi-account support)
  const body = await request.json().catch(() => ({}))
  const { connectionId } = body as { connectionId?: string }

  if (!connectionId) {
    return NextResponse.json(
      { error: 'connectionId is required' },
      { status: 400 }
    )
  }

  // Get specific connection (verify ownership)
  const [connection] = await db
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.id, connectionId),
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GOOGLE')
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Revoke token at Google (best effort)
  try {
    const accessToken = decryptToken(connection.accessToken)
    await revokeToken(accessToken)
  } catch {
    // Continue even if revocation fails
  }

  // Soft delete from database
  await db
    .update(oauthConnections)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(oauthConnections.id, connection.id))

  // Log activity
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: 'OAUTH_DISCONNECTED',
    summary: `Disconnected Google account (${connection.providerEmail})`,
    targetType: 'SETTINGS',
    targetId: user.id,
    metadata: { provider: 'GOOGLE', email: connection.providerEmail },
  })

  return NextResponse.json({ success: true })
}
