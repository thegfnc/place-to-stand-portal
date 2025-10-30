import type { Metadata } from 'next'

import { UsersSettingsTable } from './users-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole, requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const metadata: Metadata = {
  title: 'Users | Settings',
}

export default async function UsersSettingsPage() {
  const currentUser = await requireUser()
  await requireRole('ADMIN')
  const supabase = getSupabaseServiceClient()
  const [
    { data: users, error: usersError },
    { data: clientMemberships, error: clientMembershipsError },
    { data: projectMemberships, error: projectMembershipsError },
    { data: taskAssignments, error: taskAssignmentsError },
  ] = await Promise.all([
    supabase
      .from('users')
      .select(
        'id, email, full_name, role, avatar_url, created_at, updated_at, deleted_at'
      )
      .order('created_at', { ascending: false }),
    supabase.from('client_members').select('user_id').is('deleted_at', null),
    supabase.from('project_members').select('user_id').is('deleted_at', null),
    supabase.from('task_assignees').select('user_id').is('deleted_at', null),
  ])

  if (usersError) {
    console.error('Failed to load users for settings', usersError)
  }

  if (clientMembershipsError) {
    console.error('Failed to load client memberships', clientMembershipsError)
  }

  if (projectMembershipsError) {
    console.error('Failed to load project memberships', projectMembershipsError)
  }

  if (taskAssignmentsError) {
    console.error('Failed to load task assignments', taskAssignmentsError)
  }

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

  for (const membership of clientMemberships ?? []) {
    ensureSummary(membership.user_id).clients += 1
  }

  for (const membership of projectMemberships ?? []) {
    ensureSummary(membership.user_id).projects += 1
  }

  for (const assignment of taskAssignments ?? []) {
    ensureSummary(assignment.user_id).tasks += 1
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
        users={users ?? []}
        currentUserId={currentUser.id}
        assignments={assignmentCounts}
      />
    </>
  )
}
