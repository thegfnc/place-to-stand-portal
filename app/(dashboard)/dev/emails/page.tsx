import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole, type UserRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, emailMetadata } from '@/lib/db/schema'
import { desc, isNull } from 'drizzle-orm'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmailCard } from './_components/email-card'
import { SeedControls } from './_components/seed-controls'

type ClientRow = { id: string; name: string }
type EmailRow = {
  id: string
  subject: string | null
  snippet: string | null
  fromEmail: string
  receivedAt: string
}

export default async function DevEmailsPage() {
  await requireRole('ADMIN' as UserRole)

  const emails = (await db
    .select({
      id: emailMetadata.id,
      subject: emailMetadata.subject,
      snippet: emailMetadata.snippet,
      fromEmail: emailMetadata.fromEmail,
      receivedAt: emailMetadata.receivedAt,
    })
    .from(emailMetadata)
    .where(isNull(emailMetadata.deletedAt))
    .orderBy(desc(emailMetadata.receivedAt))
    .limit(50)) as EmailRow[]

  const clientList = (await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(desc(clients.createdAt))) as ClientRow[]

  return (
    <>
      <AppShellHeader>
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">Dev: Emails</h1>
          <p className="text-muted-foreground text-sm">Quickly test matching and manual linking.</p>
        </div>
      </AppShellHeader>
      <div className="p-6 grid gap-4">
        <SeedControls />
        {emails.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Emails</CardTitle>
              <CardDescription>Use POST /api/dev/seed to create test data.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          emails.map(email => (
            <EmailCard key={email.id} email={email} clients={clientList} />
          ))
        )}
      </div>
    </>
  )
}
