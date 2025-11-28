import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireUser } from '@/lib/auth/session'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'Home | Place to Stand Portal',
}

export default async function HomePage() {
  const user = await requireUser()
  const tasksResult = await fetchAssignedTasksSummary({
    userId: user.id,
    role: user.role,
    limit: 5,
    includeCompletedStatuses: false,
  })

  return (
    <HomeDashboard
      user={user}
      tasks={tasksResult.items}
      totalTaskCount={tasksResult.totalCount}
    />
  )
}
