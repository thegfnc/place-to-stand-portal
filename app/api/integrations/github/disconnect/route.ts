import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'
import { revokeToken } from '@/lib/oauth/github'
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
        eq(oauthConnections.provider, 'GITHUB')
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const login = (connection.providerMetadata as { login?: string })?.login

  // Revoke token at GitHub (best effort)
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
    summary: `Disconnected GitHub account${login ? ` (@${login})` : ''}`,
    targetType: 'SETTINGS',
    targetId: user.id,
    metadata: { provider: 'GITHUB', login },
  })

  return NextResponse.json({ success: true })
}
