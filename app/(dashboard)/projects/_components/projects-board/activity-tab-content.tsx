import { TabsContent } from '@/components/ui/tabs'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import {
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'

export type ActivityTabContentProps = {
  isActive: boolean
  activeProject: ProjectsBoardActiveProject
  activityTargetClientId: string | null
}

export function ActivityTabContent(props: ActivityTabContentProps) {
  const { isActive, activeProject, activityTargetClientId } = props

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='activity'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <div className='space-y-1'>
            <h3 className='text-lg font-semibold'>Project activity</h3>
            <p className='text-muted-foreground text-sm'>
              Review task updates, comments, and assignments for this project.
            </p>
          </div>
          <div className='mt-3'>
            <ActivityFeed
              targetType={['PROJECT', 'TASK']}
              projectId={activeProject.id}
              clientId={activityTargetClientId}
              emptyState='No project activity yet.'
            />
          </div>
        </section>
      )}
    </TabsContent>
  )
}
