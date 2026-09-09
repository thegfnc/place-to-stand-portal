import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import {
  fetchClientCycleDirectory,
  fetchProjectsForClient,
  resolveClientIdentifier,
} from '@/lib/data/clients'
import { fetchContactsForClient } from '@/lib/queries/clients/contacts'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { listClientUpdates } from '@/lib/updates'

import { ClientRecordCycle } from '../_components/client-record-cycle'
import { ClientDetail } from './_components/client-detail'

type Params = Promise<{ clientSlug: string }>

type ClientDetailPageProps = {
  params: Params
}

export async function generateMetadata({
  params,
}: ClientDetailPageProps): Promise<Metadata> {
  const { clientSlug } = await params

  try {
    const user = await requireUser()
    const client = await resolveClientIdentifier(user, clientSlug)

    return {
      title: `${client.name} | Clients | Place to Stand Portal`,
    }
  } catch {
    return {
      title: 'Client Not Found | Place to Stand Portal',
    }
  }
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { clientSlug } = await params
  const user = await requireUser()

  let client
  try {
    client = await resolveClientIdentifier(user, clientSlug)
  } catch {
    notFound()
  }

  // Build origination and closer lookups. Origination may be either a
  // contact (external referrer) or an admin user (internal partner);
  // closer is always an admin user.
  const originationContactPromise = client.originationContactId
    ? db
        .select({
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, client.originationContactId),
            isNull(contacts.deletedAt)
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null)
    : Promise.resolve(null)

  const originationUserPromise = client.originationUserId
    ? db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          and(
            eq(users.id, client.originationUserId),
            isNull(users.deletedAt)
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null)
    : Promise.resolve(null)

  const closerUserPromise = client.closerUserId
    ? db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          and(
            eq(users.id, client.closerUserId),
            isNull(users.deletedAt)
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null)
    : Promise.resolve(null)

  const [
    cycleClients,
    projects,
    clientContacts,
    recentUpdates,
    originationContact,
    originationUser,
    closerUser,
  ] = await Promise.all([
    fetchClientCycleDirectory(user),
    fetchProjectsForClient(user, client.resolvedId),
    fetchContactsForClient(client.resolvedId),
    listClientUpdates({ clientId: client.resolvedId, limit: 3 }),
    originationContactPromise,
    originationUserPromise,
    closerUserPromise,
  ])

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: client.name }]}
      contentClassName='space-y-6'
    >
      <ClientRecordCycle
        clients={cycleClients}
        selectedClientId={client.resolvedId}
      />
      <ClientDetail
        client={client}
        projects={projects}
        contacts={clientContacts}
        updates={recentUpdates.map(update => ({
          id: update.id,
          subject: update.subject,
          status: update.status,
          sentAt: update.sentAt,
          createdAt: update.createdAt,
        }))}
        clientRow={mapClientDetailToRow(client)}
        originationContact={originationContact}
        originationUser={originationUser}
        closerUser={closerUser}
      />
    </PageShell>
  )
}

function mapClientDetailToRow(
  client: Awaited<ReturnType<typeof resolveClientIdentifier>>
): ClientRow {
  return {
    id: client.resolvedId,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    website: client.website,
    state: client.state ?? null,
    origination_contact_id: client.originationContactId,
    origination_user_id: client.originationUserId,
    closer_user_id: client.closerUserId,
    billing_type: client.billingType,
    created_by: null,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
  }
}
