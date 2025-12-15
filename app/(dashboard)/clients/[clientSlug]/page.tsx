import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, eq, isNull, desc } from 'drizzle-orm'

import { AppShellHeader } from '@/components/layout/app-shell'
import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clientContacts } from '@/lib/db/schema'
import {
  fetchClientsWithMetrics,
  fetchProjectsForClient,
  resolveClientIdentifier,
} from '@/lib/data/clients'
import { buildMembersByClient, listClientUsers } from '@/lib/queries/clients'
import { getLinkedEmailsForClient } from '@/lib/queries/emails'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'

import { ClientsLandingHeader } from '../_components/clients-landing-header'
import {
  normalizeClientMembersMap,
  normalizeClientUsers,
} from '../_lib/client-user-helpers'
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

  const canManageClients = isAdmin(user)

  const managementDataPromise: Promise<
    | [
        Awaited<ReturnType<typeof listClientUsers>>,
        Awaited<ReturnType<typeof buildMembersByClient>>,
      ]
    | null
  > = canManageClients
    ? Promise.all([
        listClientUsers(),
        buildMembersByClient([client.resolvedId]),
      ])
    : Promise.resolve(null)

  const [allClients, projects, managementData, contacts, linkedEmails] = await Promise.all([
    fetchClientsWithMetrics(user),
    fetchProjectsForClient(user, client.resolvedId),
    managementDataPromise,
    db.select().from(clientContacts).where(
      and(eq(clientContacts.clientId, client.resolvedId), isNull(clientContacts.deletedAt))
    ).orderBy(desc(clientContacts.isPrimary), clientContacts.email),
    getLinkedEmailsForClient(client.resolvedId),
  ])

  const clientUsers = managementData
    ? normalizeClientUsers(managementData[0])
    : []
  const clientMembers = managementData
    ? normalizeClientMembersMap(managementData[1])
    : {}

  return (
    <>
      <AppShellHeader>
        <ClientsLandingHeader
          clients={allClients}
          selectedClientId={client.resolvedId}
        />
      </AppShellHeader>
      <div className='space-y-6'>
        <ClientDetail
          client={client}
          projects={projects}
          contacts={contacts}
          linkedEmails={linkedEmails}
          canManageClients={canManageClients}
          clientUsers={clientUsers}
          clientMembers={clientMembers}
          clientRow={mapClientDetailToRow(client)}
        />
      </div>
    </>
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
    billing_type: client.billingType,
    created_by: null,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
  }
}

