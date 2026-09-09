import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { getUserById, listUsersForSettings } from '@/lib/queries/users'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'
import { parseUsersSearchParams } from '@/lib/settings/users/filters'
import type { DbUser } from '@/lib/types'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { UsersAddButton } from './_components/users-add-button'
import { UsersFilters } from './_components/users-filters'
import { UsersManagementTable } from './_components/users-management-table'
import { USERS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Users | Settings',
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

type UserSelection = Awaited<
  ReturnType<typeof listUsersForSettings>
>['items'][number]

const toDbUser = (user: UserSelection): DbUser => ({
  id: user.id,
  email: user.email,
  full_name: user.fullName,
  role: user.role,
  avatar_url: user.avatarUrl,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
  deleted_at: user.deletedAt,
  disabled_at: user.disabledAt,
})

type UsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsersPage({
  searchParams,
}: UsersPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const preferredPageSize = await readPageSize()
  const { page, limit, role, access, search, sort } =
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
    status: 'active',
    page,
    limit: limit ?? preferredPageSize,
    role,
    access,
    search,
    sort,
  })

  const users: DbUser[] = items.map(toDbUser)

  // The list is paginated and filterable, so resolve `?user=` by id — a
  // shared link must open even when the row isn't on this page.
  const { record: deepLinkedUser, notFound: userNotFound } =
    await resolveSheetDeepLink({
      idParam: firstParam(params.user),
      fetchById: async id => toDbUser(await getUserById(currentUser, id)),
    })

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/settings/users')}
      tabs={USERS_TABS}
      activeTab='users'
      count={{ label: 'users', total: unfilteredTotalCount, filteredTotal: totalCount }}
      primaryAction={
        <UsersAddButton />
      }
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <UsersFilters
          basePath='/settings/users'
          role={role}
          access={access}
          search={search}
          showAccessFilter
        />
        <UsersManagementTable
          users={users}
          currentUserId={currentUser.id}
          assignments={assignments}
          page={servedPage}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={totalCount}
          mode='active'
          basePath='/settings/users'
          deepLinkedUser={deepLinkedUser}
          userNotFound={userNotFound}
        />
      </section>
    </PageShell>
  )
}
