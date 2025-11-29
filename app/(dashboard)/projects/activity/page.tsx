import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsActivitySection } from '../_components/projects-activity-section'
import { ProjectsTabsNav } from '../_components/projects-tabs-nav'
import { requireRole } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Project Activity | Place to Stand Portal',
}

export default async function ProjectsActivityPage() {
  await requireRole('ADMIN')

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
          <p className='text-muted-foreground text-sm'>
            Review project-level changes to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-4'>
          <ProjectsTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
        </div>
        <ProjectsActivitySection />
      </div>
    </>
  )
}
