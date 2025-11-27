import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/session'
import { fetchLeadOwners, fetchLeadsBoard } from '@/lib/data/leads'

import { LeadsWorkspace } from './_components/leads-workspace'

export const metadata: Metadata = {
  title: 'Leads | Place to Stand Portal',
}

export default async function LeadsPage() {
  const user = await requireUser()
  const [board, owners] = await Promise.all([
    fetchLeadsBoard(user),
    fetchLeadOwners(),
  ])

  return (
    <LeadsWorkspace
      initialColumns={board}
      owners={owners}
      canManage={user.role === 'ADMIN'}
    />
  )
}
