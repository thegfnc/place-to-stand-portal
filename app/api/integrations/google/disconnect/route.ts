import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'
import { revokeToken } from '@/lib/oauth/google'
import { logActivity } from '@/lib/activity/logger'

export async function POST() {
  const user = await requireUser()

  // Get existing connection
  const [connection] = await db
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GOOGLE')
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json({ error: 'No connection found' }, { status: 404 })
  }

  // Revoke token at Google (best effort)
  try {
    const accessToken = decryptToken(connection.accessToken)
    await revokeToken(accessToken)
  } catch {
    // Continue even if revocation fails
  }

  // Delete from database
  await db
    .delete(oauthConnections)
    .where(eq(oauthConnections.id, connection.id))

  // Log activity
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: 'OAUTH_DISCONNECTED',
    summary: 'Disconnected Google account',
    targetType: 'SETTINGS',
    targetId: user.id,
    metadata: { provider: 'GOOGLE' },
  })

  return NextResponse.json({ success: true })
}
