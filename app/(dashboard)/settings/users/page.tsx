import type { Metadata } from 'next'

import { UsersSettingsTable } from './users-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listUsersForSettings } from '@/lib/queries/users'
import type { DbUser } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Users | Settings',
}

type UsersSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type UsersTab = 'users' | 'archive' | 'activity'

export default async function UsersSettingsPage({
  searchParams,
}: UsersSettingsPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const tabParamRaw = params.tab
  const tabParam =
    typeof tabParamRaw === 'string'
      ? tabParamRaw
      : Array.isArray(tabParamRaw)
        ? tabParamRaw[0]
        : 'users'

  const tab: UsersTab =
    tabParam === 'archive'
      ? 'archive'
      : tabParam === 'activity'
        ? 'activity'
        : 'users'

  const status = tab === 'archive' ? 'archived' : 'active'
  const cursor =
    typeof params.cursor === 'string'
      ? params.cursor
      : Array.isArray(params.cursor)
        ? (params.cursor[0] ?? null)
        : null
  const directionParam =
    typeof params.dir === 'string'
      ? params.dir
      : Array.isArray(params.dir)
        ? (params.dir[0] ?? null)
        : null
  const direction =
    directionParam === 'backward' ? 'backward' : ('forward' as const)
  const limitParamRaw =
    typeof params.limit === 'string'
      ? params.limit
      : Array.isArray(params.limit)
        ? params.limit[0]
        : undefined
  const limitParam = Number.parseInt(limitParamRaw ?? '', 10)

  const { items, assignments, totalCount, pageInfo } =
    await listUsersForSettings(currentUser, {
      status,
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
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
  }))

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Users</h1>
          <p className='text-muted-foreground text-sm'>
            Manage users and their roles.
          </p>
        </div>
      </AppShellHeader>
      <UsersSettingsTable
        users={users}
        currentUserId={currentUser.id}
        assignments={assignments}
        tab={tab}
        pageInfo={pageInfo}
        totalCount={totalCount}
      />
    </>
  )
}
