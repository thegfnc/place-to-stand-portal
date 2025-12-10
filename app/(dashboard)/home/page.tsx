import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireUser } from '@/lib/auth/session'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'
import {
  fetchRecentlyViewedClients,
  fetchRecentlyViewedProjects,
} from '@/lib/data/dashboard/recently-viewed'
import type { RecentlyViewedSummary } from '@/lib/dashboard/types'

export const metadata: Metadata = {
  title: 'Home | Place to Stand Portal',
}

export default async function HomePage() {
  const user = await requireUser()
  const now = new Date()
  const currentMonthCursor = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  }

  const [tasksResult, recentProjectsRaw, recentClientsRaw, hoursSnapshot] =
    await Promise.all([
      fetchAssignedTasksSummary({
        userId: user.id,
        role: user.role,
        limit: 5,
        includeCompletedStatuses: false,
      }),
      fetchRecentlyViewedProjects(user),
      fetchRecentlyViewedClients(user),
      fetchHoursSnapshot(user, currentMonthCursor),
    ])

  const recentProjects: RecentlyViewedSummary[] = recentProjectsRaw.map(
    item => ({
      id: item.id,
      name: item.name,
      href: item.href,
      touchedAt: item.touchedAt,
      contextLabel: item.clientName ?? null,
    })
  )

  const recentClients: RecentlyViewedSummary[] = recentClientsRaw.map(item => ({
    id: item.id,
    name: item.name,
    href: item.href,
    touchedAt: item.touchedAt,
  }))

  return (
    <HomeDashboard
      user={user}
      tasks={tasksResult.items}
      totalTaskCount={tasksResult.totalCount}
      recentProjects={recentProjects}
      recentClients={recentClients}
      initialHoursSnapshot={hoursSnapshot}
    />
  )
}
