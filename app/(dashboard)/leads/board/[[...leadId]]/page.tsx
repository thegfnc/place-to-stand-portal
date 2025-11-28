import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/session'
import { fetchLeadAssignees, fetchLeadsBoard } from '@/lib/data/leads'

import { LeadsWorkspace } from '../../_components/leads-workspace'

export const metadata: Metadata = {
  title: 'Leads | Place to Stand Portal',
}

type PageParams = {
  leadId?: string[]
}

type PageProps = {
  params: Promise<PageParams>
}

export default async function LeadsBoardPage({ params }: PageProps) {
  const resolvedParams = await params
  const requestedLeadId = resolvedParams.leadId?.[0] ?? null
  const user = await requireUser()

  if (requestedLeadId && user.role !== 'ADMIN') {
    redirect('/leads/board')
  }

  const activeLeadId = user.role === 'ADMIN' ? requestedLeadId : null
  const [board, assignees] = await Promise.all([
    fetchLeadsBoard(user),
    fetchLeadAssignees(),
  ])

  return (
    <LeadsWorkspace
      initialColumns={board}
      assignees={assignees}
      canManage={user.role === 'ADMIN'}
      activeLeadId={activeLeadId}
    />
  )
}

