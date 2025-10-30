import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireUser } from '@/lib/auth/session'
import { fetchAssignedTasks } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'Home | Place to Stand Portal',
}

export default async function HomePage() {
  const user = await requireUser()
  const tasks = await fetchAssignedTasks({
    userId: user.id,
    role: user.role,
  })

  return <HomeDashboard user={user} tasks={tasks} />
}
