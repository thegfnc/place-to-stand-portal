'use client'

import dynamic from 'next/dynamic'

const ProjectsActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity…
      </div>
    ),
  }
)

export function ProjectsActivitySection() {
  return (
    <section className='bg-background rounded-xl border p-6 shadow-sm space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          Audit project creation, edits, archives, and deletions in one place.
        </p>
      </div>
      <ProjectsActivityFeed
        targetType='PROJECT'
        pageSize={20}
        emptyState='No recent project activity.'
        requireContext={false}
      />
    </section>
  )
}
