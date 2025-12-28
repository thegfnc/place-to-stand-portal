import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { oauthConnections, clients } from '@/lib/db/schema'
import { listThreadsForUser } from '@/lib/queries/threads'
import { getMessageCountsForUser } from '@/lib/queries/messages'
import { InboxPanel } from './_components/inbox-panel'

export default async function InboxPage() {
  const user = await requireUser()

  // Get threads, message counts, sync status, and clients in parallel
  const [threadSummaries, messageCounts, [connection], clientsList] = await Promise.all([
    listThreadsForUser(user.id, { limit: 100 }),
    getMessageCountsForUser(user.id),
    db
      .select({ lastSyncAt: oauthConnections.lastSyncAt })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, user.id),
          eq(oauthConnections.provider, 'GOOGLE'),
          isNull(oauthConnections.deletedAt)
        )
      )
      .limit(1),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.name),
  ])

  const syncStatus = {
    connected: !!connection,
    lastSyncAt: connection?.lastSyncAt ?? null,
    totalMessages: messageCounts.total,
    unread: messageCounts.unread,
  }

  return (
    <InboxPanel
      threads={threadSummaries}
      syncStatus={syncStatus}
      clients={clientsList}
      isAdmin={isAdmin(user)}
    />
  )
}
