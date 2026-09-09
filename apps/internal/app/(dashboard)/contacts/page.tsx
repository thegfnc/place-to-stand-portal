import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { listContactsForSettings, listAllActiveClients } from '@/lib/queries/contacts'
import { parseContactsSearchParams } from '@/lib/settings/contacts/filters'
import { serverEnv } from '@/lib/env.server'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { CONTACTS_TABS } from './_lib/tabs'
import { ContactsAddButton } from './_components/contacts-add-button'
import { ContactsFilters } from './_components/contacts-filters'
import { ContactsManagementTable } from './_components/contacts-management-table'
import { resolveContactDeepLink } from './_lib/contact-deep-link'
import { mapContactToTableRow } from './_lib/map-contact-to-table-row'

export const metadata: Metadata = {
  title: 'Contacts | Place to Stand Portal',
}


type ContactsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}
  const pageSize = await readPageSize()
  const {
    page: currentPage,
    search,
    clientId,
    sort,
  } = parseContactsSearchParams(params)
  const offset = (currentPage - 1) * pageSize

  // Share links: `?contact=<id>` opens the edit sheet even when the row sits
  // on another page (redirects to the archive tab when it's archived).
  const contactParam = params.contact
  const deepLink = await resolveContactDeepLink(
    user,
    Array.isArray(contactParam) ? contactParam[0] : contactParam,
    'active'
  )

  const [{ items, totalCount, unfilteredTotalCount }, allClients] =
    await Promise.all([
      listContactsForSettings(user, {
        status: 'active',
        search,
        clientId,
        offset,
        limit: pageSize,
        sort,
      }),
      listAllActiveClients(user),
    ])

  const contactsForTable = items.map(mapContactToTableRow)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  // The sheet only needs the minimal row — it self-fetches its client links.
  const deepLinkedContact = deepLink.record
    ? {
        id: deepLink.record.id,
        email: deepLink.record.email,
        name: deepLink.record.name,
        phone: deepLink.record.phone,
      }
    : null

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/contacts')}
      tabs={CONTACTS_TABS}
      activeTab='contacts'
      count={{
        label: 'contacts',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<ContactsAddButton />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-4'>
        <ContactsFilters
          basePath='/contacts'
          search={search}
          clientId={clientId}
          clients={allClients}
        />
        <ContactsManagementTable
          contacts={contactsForTable}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode='active'
          allClients={allClients}
          basePath='/contacts'
          deepLinkedContact={deepLinkedContact}
          contactNotFound={deepLink.notFound}
          clientPortalUrl={serverEnv.CLIENT_PORTAL_URL ?? ''}
        />
      </section>
    </PageShell>
  )
}
