import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'

export async function GET() {
  const user = await requireUser()

  const [connection] = await db
    .select({
      status: oauthConnections.status,
      providerEmail: oauthConnections.providerEmail,
      scopes: oauthConnections.scopes,
      lastSyncAt: oauthConnections.lastSyncAt,
      createdAt: oauthConnections.createdAt,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GOOGLE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    status: connection.status,
    email: connection.providerEmail,
    scopes: connection.scopes,
    lastSyncAt: connection.lastSyncAt,
    connectedAt: connection.createdAt,
  })
}
