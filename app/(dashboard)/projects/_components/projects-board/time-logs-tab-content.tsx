'use client'

import { TabsContent } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import {
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import { ProjectTimeLogHistoryContent } from '../project-time-log/project-time-log-history-content'
import { useProjectTimeLogHistory } from '@/lib/projects/time-log/use-project-time-log-history'
import type { UserRole } from '@/lib/auth/session'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

type TimeLogsTabContentProps = {
  isActive: boolean
  activeProject: ProjectsBoardActiveProject
  currentUserId: string | null
  currentUserRole: UserRole
  canLogTime: boolean
  onEditEntry: (entry: TimeLogEntry) => void
}

export function TimeLogsTabContent(props: TimeLogsTabContentProps) {
  const {
    isActive,
    activeProject,
    currentUserId,
    currentUserRole,
    canLogTime,
    onEditEntry,
  } = props

  const historyState = useProjectTimeLogHistory({
    projectId: activeProject?.id ?? '',
    projectName: activeProject?.name ?? '',
    clientName: activeProject?.client?.name ?? null,
    currentUserId: currentUserId ?? '',
    currentUserRole,
    enabled: Boolean(isActive && activeProject && currentUserId),
  })

  if (!isActive) {
    return null
  }

  if (!activeProject || !currentUserId) {
    return (
      <TabsContent
        value='timeLogs'
        className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
      >
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      </TabsContent>
    )
  }

  return (
    <TabsContent
      value='timeLogs'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <div className='space-y-1'>
          <h3 className='text-lg font-semibold'>Project time logs</h3>
          <p className='text-muted-foreground text-sm'>
            Review and manage the latest hours recorded for this project.
          </p>
        </div>
        <div className='mt-4'>
          <ProjectTimeLogHistoryContent
            state={historyState}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            canLogTime={canLogTime}
            onEditEntry={onEditEntry}
          />
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(historyState.deleteState.pendingEntry)}
        title='Delete time entry?'
        description='This removes the log from the project burndown.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={historyState.deleteState.isMutating}
        onCancel={historyState.deleteState.cancel}
        onConfirm={historyState.deleteState.confirm}
      />
    </TabsContent>
  )
}

