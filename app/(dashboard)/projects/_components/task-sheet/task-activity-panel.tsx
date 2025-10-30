'use client'

import { ActivityFeed } from '@/components/activity/activity-feed'
import { Separator } from '@/components/ui/separator'

type TaskActivityPanelProps = {
  taskId: string | null
  projectId: string
  clientId?: string | null
}

export function TaskActivityPanel({
  taskId,
  projectId,
  clientId,
}: TaskActivityPanelProps) {
  if (!taskId) {
    return (
      <div className='space-y-2'>
        <Separator />
        <h3 className='text-base font-semibold'>Activity</h3>
        <p className='text-muted-foreground text-sm'>
          Log history becomes available once the task is created.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <Separator />
      <h3 className='text-base font-semibold'>Activity</h3>
      <ActivityFeed
        targetType='TASK'
        targetId={taskId}
        projectId={projectId}
        clientId={clientId ?? null}
        emptyState='No activity recorded yet.'
      />
    </div>
  )
}
