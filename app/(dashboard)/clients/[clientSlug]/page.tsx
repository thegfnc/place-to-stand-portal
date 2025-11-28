import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireUser } from '@/lib/auth/session'
import {
  fetchClientsWithMetrics,
  fetchProjectsForClient,
  resolveClientIdentifier,
} from '@/lib/data/clients'

import { ClientsLandingHeader } from '../_components/clients-landing-header'
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

  const [allClients, projects] = await Promise.all([
    fetchClientsWithMetrics(user),
    fetchProjectsForClient(user, client.resolvedId),
  ])

  return (
    <>
      <AppShellHeader>
        <ClientsLandingHeader
          clients={allClients}
          selectedClientId={client.resolvedId}
        />
      </AppShellHeader>
      <div className='space-y-6'>
        <ClientDetail client={client} projects={projects} />
      </div>
    </>
  )
}

