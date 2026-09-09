import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import {
  getHourBlockWithClientById,
  listHourBlockInvoiceDirectory,
  listHourBlocksForSettings,
} from '@/lib/queries/hour-blocks'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'
import { hourBlockHref } from '@/lib/sheets/hrefs'
import { parseHourBlocksSearchParams } from '@/lib/settings/hour-blocks/filters'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { HourBlocksAddButton } from './_components/hour-blocks-add-button'
import { HourBlocksFilters } from './_components/hour-blocks-filters'
import { HourBlocksManagementTable } from './_components/hour-blocks-management-table'
import { HOUR_BLOCKS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Hour Blocks | Settings',
}


const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

type HourBlocksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function HourBlocksPage({
  searchParams,
}: HourBlocksPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const pageSize = await readPageSize()

  const { page: currentPage, search, sort } = parseHourBlocksSearchParams(params)
  const offset = (currentPage - 1) * pageSize

  const [
    { items, clients, totalCount, unfilteredTotalCount },
    invoiceDirectory,
  ] = await Promise.all([
    listHourBlocksForSettings(currentUser, {
      status: 'active',
      offset,
      limit: pageSize,
      search,
      sort,
    }),
    listHourBlockInvoiceDirectory(currentUser),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // The list is paginated and filterable, so resolve `?hour-block=` by id —
  // a shared link must open even when the row isn't on this page.
  const { record: deepLinkedHourBlock, notFound: hourBlockNotFound } =
    await resolveSheetDeepLink({
      idParam: firstParam(params['hour-block']),
      fetchById: id => getHourBlockWithClientById(currentUser, id),
      tab: 'active',
      isArchived: block => block.deleted_at !== null,
      archiveHref: id => `/hour-blocks/archive?hour-block=${id}`,
      activeHref: hourBlockHref,
    })

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/hour-blocks')}
      tabs={HOUR_BLOCKS_TABS}
      activeTab='hour-blocks'
      count={{
        label: 'hour blocks',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<HourBlocksAddButton clients={clients} />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <HourBlocksFilters basePath='/hour-blocks' search={search} />
        <HourBlocksManagementTable
          hourBlocks={items}
          clients={clients}
          invoices={invoiceDirectory}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode='active'
          basePath='/hour-blocks'
          deepLinkedHourBlock={deepLinkedHourBlock}
          hourBlockNotFound={hourBlockNotFound}
        />
      </section>
    </PageShell>
  )
}
