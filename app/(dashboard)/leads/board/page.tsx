import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/session'
import { fetchLeadAssignees, fetchLeadsBoard } from '@/lib/data/leads'

import { LeadsWorkspace } from '../_components/leads-workspace'

export const metadata: Metadata = {
  title: 'Leads | Place to Stand Portal',
}

export default async function LeadsBoardPage() {
  const user = await requireUser()
  const [board, assignees] = await Promise.all([
    fetchLeadsBoard(user),
    fetchLeadAssignees(),
  ])

  return (
    <LeadsWorkspace
      initialColumns={board}
      assignees={assignees}
      canManage={user.role === 'ADMIN'}
    />
  )
}

