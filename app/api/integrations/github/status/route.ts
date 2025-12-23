import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'

export async function GET() {
  const user = await requireUser()

  // Fetch all GitHub accounts for this user (multi-account support)
  const connections = await db
    .select({
      id: oauthConnections.id,
      status: oauthConnections.status,
      providerEmail: oauthConnections.providerEmail,
      displayName: oauthConnections.displayName,
      providerAccountId: oauthConnections.providerAccountId,
      scopes: oauthConnections.scopes,
      lastSyncAt: oauthConnections.lastSyncAt,
      createdAt: oauthConnections.createdAt,
      providerMetadata: oauthConnections.providerMetadata,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GITHUB'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .orderBy(oauthConnections.createdAt)

  if (connections.length === 0) {
    return NextResponse.json({ connected: false, accounts: [] })
  }

  return NextResponse.json({
    connected: true,
    accounts: connections.map(c => ({
      id: c.id,
      email: c.providerEmail,
      displayName: c.displayName || c.providerEmail,
      login: (c.providerMetadata as { login?: string })?.login,
      status: c.status,
      scopes: c.scopes,
      lastSyncAt: c.lastSyncAt,
      connectedAt: c.createdAt,
      metadata: c.providerMetadata,
    })),
  })
}
