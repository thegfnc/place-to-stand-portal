import type { Metadata } from 'next'

import { UsersSettingsTable } from './users-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import {
  listUsersWithAssignmentCounts,
} from '@/lib/queries/users'
import type { Database } from '@/supabase/types/database'

export const metadata: Metadata = {
  title: 'Users | Settings',
}

export default async function UsersSettingsPage() {
  const currentUser = await requireRole('ADMIN')

  const userRecords = await listUsersWithAssignmentCounts(currentUser)

  const users: Database['public']['Tables']['users']['Row'][] = userRecords.map(
    user => ({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      deleted_at: user.deletedAt,
    })
  )

  const assignmentCounts: Record<
    string,
    { clients: number; projects: number; tasks: number }
  > = {}

  const ensureSummary = (userId: string) => {
    if (!assignmentCounts[userId]) {
      assignmentCounts[userId] = { clients: 0, projects: 0, tasks: 0 }
    }
    return assignmentCounts[userId]
  }

  for (const user of users) {
    ensureSummary(user.id)
  }

  for (const record of userRecords) {
    const summary = ensureSummary(record.id)
    summary.clients = record.clientsCount
    summary.tasks = record.tasksCount
    // Projects count remains 0 as project_members no longer exists.
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
        assignments={assignmentCounts}
      />
    </>
  )
}
