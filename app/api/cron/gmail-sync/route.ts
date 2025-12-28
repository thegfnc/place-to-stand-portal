import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { syncGmailForUser } from '@/lib/email/sync'

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all active Google connections
  const connections = await db
    .select({ userId: oauthConnections.userId })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.provider, 'GOOGLE'),
        eq(oauthConnections.status, 'ACTIVE'),
        isNull(oauthConnections.deletedAt)
      )
    )

  const results: Array<{ userId: string; synced: number; skipped: number; error?: string }> = []

  for (const conn of connections) {
    try {
      const result = await syncGmailForUser(conn.userId)
      results.push({ userId: conn.userId, synced: result.synced, skipped: result.skipped })
    } catch (err) {
      results.push({ userId: conn.userId, synced: 0, skipped: 0, error: err instanceof Error ? err.message : 'unknown' })
    }
  }

  return NextResponse.json({ processed: connections.length, results })
}
