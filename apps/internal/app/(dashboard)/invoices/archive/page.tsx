import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { getInvoiceById, listInvoices } from '@/lib/queries/invoices'
import { parseInvoicesSearchParams } from '@/lib/invoices/filters'
import { invoiceHref } from '@/lib/sheets/hrefs'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { InvoicesAddButton } from '../_components/invoices-add-button'
import { InvoicesFilters } from '../_components/invoices-filters'
import { InvoicesManagementTable } from '../_components/invoices-management-table'
import { INVOICES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Invoices Archive',
}


type InvoicesArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoicesArchivePage({
  searchParams,
}: InvoicesArchivePageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const pageSize = await readPageSize()

  const { page: currentPage, status, search, sort } =
    parseInvoicesSearchParams(params)
  const offset = (currentPage - 1) * pageSize

  const {
    items,
    clients,
    productCatalog,
    taxRates,
    totalCount,
    unfilteredTotalCount,
  } = await listInvoices(currentUser, {
    status: 'archived',
    offset,
    limit: pageSize,
    invoiceStatus: status,
    search,
    sort,
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Restored invoices leave this tab, so a shared archive link cross-redirects
  // to the active tab instead of dead-ending.
  const { record: deepLinkedInvoice, notFound: invoiceNotFound } =
    await resolveSheetDeepLink({
      idParam: typeof params.invoice === 'string' ? params.invoice : undefined,
      fetchById: id => getInvoiceById(currentUser, id),
      tab: 'archive',
      isArchived: invoice => Boolean(invoice.deleted_at),
      activeHref: invoiceHref,
      archiveHref: id => `/invoices/archive?invoice=${id}`,
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/invoices'), { label: 'Archive' }]}
      tabs={INVOICES_TABS}
      activeTab='archive'
      count={{
        label: 'archived invoices',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<InvoicesAddButton clients={clients} />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <InvoicesFilters
          basePath='/invoices/archive'
          status={status}
          search={search}
        />
        <InvoicesManagementTable
          invoices={items}
          clients={clients}
          productCatalog={productCatalog}
          taxRates={taxRates}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode='archive'
          basePath='/invoices/archive'
          deepLinkedInvoice={deepLinkedInvoice}
          invoiceNotFound={invoiceNotFound}
        />
      </section>
    </PageShell>
  )
}
