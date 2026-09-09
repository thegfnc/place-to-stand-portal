import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'

import { PageShell } from '@/components/layout/page-shell'
import { requireUser } from '@/lib/auth/session'
import { fetchClientById } from '@/lib/data/clients'
import { db } from '@/lib/db'
import { NotFoundError } from '@/lib/errors/http'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { fetchContactsForClient } from '@/lib/queries/clients/contacts'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { clientDetailHref } from '@/lib/sheets/hrefs'
import { fetchClientUpdate, type ClientUpdateRow } from '@/lib/updates'
import {
  fetchComposerTaskOptions,
  fetchLatestCommentHints,
} from '@/lib/updates/composer-data'
import { greetingNameFromContacts } from '@/lib/updates/default-recipients'
import { portalHomeHref } from '@/lib/updates/links'
import { fetchActiveStaff } from '@/lib/updates/staff'

import { UpdateComposer } from './_components/update-composer'

type Params = Promise<{ updateId: string }>

type UpdatePageProps = {
  params: Params
}

async function loadUpdate(updateId: string): Promise<ClientUpdateRow | null> {
  // UUID-guard before the query so a stray path segment is a 404, not a
  // driver cast error.
  if (!UUID_PATTERN.test(updateId)) return null
  try {
    return await fetchClientUpdate(updateId)
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

export async function generateMetadata({
  params,
}: UpdatePageProps): Promise<Metadata> {
  const { updateId } = await params
  await requireUser()
  const update = await loadUpdate(updateId)

  return {
    title: update
      ? `${update.subject} | Updates | Place to Stand Portal`
      : 'Update Not Found | Place to Stand Portal',
  }
}

export default async function UpdatePage({ params }: UpdatePageProps) {
  const { updateId } = await params
  const user = await requireUser()

  const update = await loadUpdate(updateId)
  if (!update) notFound()

  const taskIds = update.items
    .map(item => item.taskId)
    .filter((id): id is string => !!id)
  const [client, contacts, hoursByClient, taskOptions, hints, staff] =
    await Promise.all([
      fetchClientById(user, update.clientId),
      fetchContactsForClient(update.clientId),
      getClientHoursTotals(db, [update.clientId]),
      fetchComposerTaskOptions(update.clientId),
      fetchLatestCommentHints(taskIds),
      fetchActiveStaff(),
    ])

  const hours =
    client.billingType === 'prepaid'
      ? clientHoursTotalsFor(hoursByClient, client.id)
      : null

  return (
    <PageShell
      breadcrumbs={[
        ...crumbsForNav('/clients'),
        { label: client.name, href: clientDetailHref(client) },
        { label: update.status === 'SENT' ? 'Sent update' : 'Draft update' },
      ]}
    >
      <UpdateComposer
        update={update}
        clientName={client.name}
        contacts={contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          isPrimary: contact.isPrimary,
        }))}
        hours={hours}
        portalHref={portalHomeHref()}
        greetingName={greetingNameFromContacts(contacts)}
        taskOptions={taskOptions}
        hints={hints}
        staff={staff}
        replyTo={user.email}
      />
    </PageShell>
  )
}
