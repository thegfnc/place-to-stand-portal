import type { Metadata } from 'next'

import { UsersSettingsTable } from './users-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole, requireUser } from '@/lib/auth/session'
import type { UserRow } from '@/lib/db/schema'
import {
  fetchUsersWithAssignments,
  type AssignmentCounts,
} from '@/lib/db/settings/users'

export const metadata: Metadata = {
  title: 'Users | Settings',
}

export default async function UsersSettingsPage() {
  const currentUser = await requireUser()
  await requireRole('ADMIN')
  let users: UserRow[] = []
  let assignments: AssignmentCounts = {}

  try {
    const result = await fetchUsersWithAssignments()
    users = result.users
    assignments = result.assignments
  } catch (error) {
    console.error('Failed to load users for settings', error)
  }

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Team members
          </h1>
          <p className='text-muted-foreground text-sm'>
            Invite administrators, contractors, and clients to collaborate
            inside the portal.
          </p>
        </div>
      </AppShellHeader>
      <UsersSettingsTable
        users={users}
        currentUserId={currentUser.id}
        assignments={assignments}
      />
    </>
  )
}
