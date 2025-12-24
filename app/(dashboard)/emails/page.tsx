import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { getEmailsWithLinks } from '@/lib/queries/emails'
import { EmailsPanel } from './_components/emails-panel'

export default async function EmailsPage() {
  const user = await requireUser()

  // Get emails and sync status in parallel
  const [emails, [connection]] = await Promise.all([
    getEmailsWithLinks(user.id, { limit: 200 }),
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
  ])

  const syncStatus = {
    connected: !!connection,
    lastSyncAt: connection?.lastSyncAt ?? null,
    totalEmails: emails.length,
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Emails</h1>
        <p className='text-muted-foreground'>
          View and link synced emails to clients and projects.
        </p>
      </div>
      <EmailsPanel
        initialEmails={emails}
        syncStatus={syncStatus}
        isAdmin={isAdmin(user)}
      />
    </div>
  )
}
