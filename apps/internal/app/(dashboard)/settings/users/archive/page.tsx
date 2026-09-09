import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { getUserById, listUsersForSettings } from '@/lib/queries/users'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'
import { parseUsersSearchParams } from '@/lib/settings/users/filters'
import type { DbUser } from '@/lib/types'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { UsersAddButton } from '../_components/users-add-button'
import { UsersFilters } from '../_components/users-filters'
import { UsersManagementTable } from '../_components/users-management-table'
import { USERS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'User Archive | Settings',
}

type UsersArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsersArchivePage({
  searchParams,
}: UsersArchivePageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const preferredPageSize = await readPageSize()
  const { page, limit, role, search, sort } =
    parseUsersSearchParams(params)

  const {
    items,
    assignments,
    totalCount,
    unfilteredTotalCount,
    page: servedPage,
    pageSize,
    totalPages,
  } = await listUsersForSettings(currentUser, {
    status: 'archived',
    page,
    limit: limit ?? preferredPageSize,
    role,
    search,
    sort,
  })

  const users: DbUser[] = items.map(user => ({
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    avatar_url: user.avatarUrl,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    deleted_at: user.deletedAt,
    disabled_at: user.disabledAt,
  }))

  // Resolve `?user=` by id so a shared link opens even when the row isn't on
  // this page of the archive.
  const { record: deepLinkedUser, notFound: userNotFound } =
    await resolveSheetDeepLink({
      idParam: Array.isArray(params.user) ? params.user[0] : params.user,
      fetchById: async id => {
        const row = await getUserById(currentUser, id)
        return {
          id: row.id,
          email: row.email,
          full_name: row.fullName,
          role: row.role,
          avatar_url: row.avatarUrl,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
          deleted_at: row.deletedAt,
          disabled_at: row.disabledAt,
        } satisfies DbUser
      },
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/settings/users'), { label: 'Archive' }]}
      tabs={USERS_TABS}
      activeTab='archive'
      count={{ label: 'archived users', total: unfilteredTotalCount, filteredTotal: totalCount }}
      primaryAction={
        <UsersAddButton />
      }
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <UsersFilters
          basePath='/settings/users/archive'
          role={role}
          search={search}
          showAccessFilter={false}
        />
        <UsersManagementTable
          users={users}
          currentUserId={currentUser.id}
          assignments={assignments}
          page={servedPage}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={totalCount}
          mode='archive'
          basePath='/settings/users/archive'
          deepLinkedUser={deepLinkedUser}
          userNotFound={userNotFound}
        />
      </section>
    </PageShell>
  )
}
