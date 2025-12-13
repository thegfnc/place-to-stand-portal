'use client'

import { AppShellHeader } from '@/components/layout/app-shell'
import type { AppUser } from '@/lib/auth/session'
import type { AssignedTaskSummary } from '@/lib/data/tasks'
import type {
  HoursSnapshot,
  RecentlyViewedSummary,
} from '@/lib/dashboard/types'

import { MyTasksWidget } from './my-tasks-widget'
import { RecentActivityOverviewWidget } from './recent-activity-overview-widget'
import { RecentlyViewedWidget } from './recently-viewed-widget'
import { HoursWidget } from './hours-widget'

type HomeDashboardProps = {
  user: AppUser
  tasks: AssignedTaskSummary[]
  totalTaskCount: number
  recentProjects: RecentlyViewedSummary[]
  recentClients: RecentlyViewedSummary[]
  initialHoursSnapshot: HoursSnapshot
}

export function HomeDashboard({
  user,
  tasks,
  totalTaskCount,
  recentProjects,
  recentClients,
  initialHoursSnapshot,
}: HomeDashboardProps) {
  const displayName = getDisplayName(user)

  return (
    <div className='flex flex-1 flex-col gap-6'>
      <AppShellHeader>
        <h1 className='text-2xl font-semibold tracking-tight'>Home</h1>
        <p className='text-muted-foreground text-sm'>
          {displayName
            ? `Welcome back, ${displayName}. Here is what needs your attention.`
            : 'Welcome back. Here is what needs your attention.'}
        </p>
      </AppShellHeader>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        <div>
          <MyTasksWidget
            tasks={tasks}
            role={user.role}
            totalCount={totalTaskCount}
            className='mb-6'
          />
          <RecentlyViewedWidget
            projects={recentProjects}
            clients={recentClients}
            className='mb-6'
          />
        </div>
        <div>
          <HoursWidget
            initialSnapshot={initialHoursSnapshot}
            className='mb-6'
          />
          <RecentActivityOverviewWidget className='mb-6' />
        </div>
      </div>
    </div>
  )
}

function getDisplayName(user: AppUser): string | null {
  const fullName = user.full_name?.trim() ?? ''

  if (fullName) {
    const [first] = fullName.split(/\s+/)
    return first || fullName
  }

  const emailHandle = user.email?.split('@')[0]
  return emailHandle ? emailHandle : null
}
