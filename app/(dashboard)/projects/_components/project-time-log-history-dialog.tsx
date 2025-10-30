'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ProjectTimeLogHistoryDialogParams } from '@/lib/projects/time-log/types'
import { useProjectTimeLogHistory } from '@/lib/projects/time-log/use-project-time-log-history'

import { ProjectTimeLogHistoryContent } from './project-time-log/project-time-log-history-content'

export type ProjectTimeLogHistoryDialogProps =
  ProjectTimeLogHistoryDialogParams & {
    open: boolean
    onOpenChange: (open: boolean) => void
  }

export function ProjectTimeLogHistoryDialog(
  props: ProjectTimeLogHistoryDialogProps
) {
  const { open, onOpenChange, ...rest } = props
  const historyParams = rest as ProjectTimeLogHistoryDialogParams

  const state = useProjectTimeLogHistory({
    ...historyParams,
    open,
    onOpenChange,
  })

  return (
    <>
      <Dialog open={open} onOpenChange={state.handleDialogOpenChange}>
        <DialogContent className='max-h-[90vh] w-full max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-7xl'>
          <DialogHeader>
            <DialogTitle>Project time logs</DialogTitle>
            <DialogDescription>
              Viewing the most recent entries recorded for {state.projectLabel}.
            </DialogDescription>
          </DialogHeader>
          <ProjectTimeLogHistoryContent
            state={state}
            currentUserId={historyParams.currentUserId}
            currentUserRole={historyParams.currentUserRole}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(state.deleteState.pendingEntry)}
        title='Delete time entry?'
        description='This removes the log from the project burndown.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={state.deleteState.isMutating}
        onCancel={state.deleteState.cancel}
        onConfirm={state.deleteState.confirm}
      />
    </>
  )
}
