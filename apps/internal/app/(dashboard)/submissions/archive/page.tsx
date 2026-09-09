import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { fetchFormSubmissions } from '@/lib/data/form-submissions'
import {
  isFormSubmissionKind,
  isFormSubmissionStatus,
} from '@/lib/form-submissions/constants'
import { parseSubmissionsSort } from '@/lib/form-submissions/filters'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { SubmissionsFilters } from '../_components/submissions-filters'
import { SubmissionsTable } from '../_components/submissions-table'
import { resolveSubmissionDeepLink } from '../_lib/submission-deep-link'
import { SUBMISSIONS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Submissions Archive',
}


type SubmissionsArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function SubmissionsArchivePage({
  searchParams,
}: SubmissionsArchivePageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const pageSize = await readPageSize()

  const currentPage = Math.max(
    1,
    Number.parseInt(firstParam(params.page) ?? '1', 10) || 1
  )

  const kindParam = firstParam(params.kind)
  const statusParam = firstParam(params.status)
  const kind = isFormSubmissionKind(kindParam) ? kindParam : undefined
  const status = isFormSubmissionStatus(statusParam) ? statusParam : undefined
  const search = firstParam(params.q)?.trim() || undefined
  const sort = parseSubmissionsSort(firstParam(params.sort))

  // Share links: ?submission=<id> opens the detail sheet directly (redirects
  // to the active tab when the row isn't archived).
  const deepLink = await resolveSubmissionDeepLink(
    currentUser,
    firstParam(params.submission),
    'archive'
  )

  const { items, totalCount, unfilteredTotalCount, totalPages } =
    await fetchFormSubmissions(currentUser, {
      page: currentPage,
      pageSize: pageSize,
      kind,
      status,
      archived: true,
      search,
      sort,
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/submissions'), { label: 'Archive' }]}
      tabs={SUBMISSIONS_TABS}
      activeTab='archive'
      count={{
        label: 'archived submissions',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-4'>
        <SubmissionsFilters
          search={search}
          activeKind={kind}
          activeStatus={status}
          basePath='/submissions/archive'
        />
        <SubmissionsTable
          submissions={items}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode='archive'
          basePath='/submissions/archive'
          deepLinkedSubmission={deepLink.submission}
          deepLinkNotFound={deepLink.notFound}
        />
      </section>
    </PageShell>
  )
}
