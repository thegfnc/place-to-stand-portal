'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProjectTimeLogForm } from './project-time-log-form'
import { useProjectTimeLogDialog } from '@/lib/projects/time-log/use-project-time-log-dialog'
import type { ProjectTimeLogDialogParams } from '@/lib/projects/time-log/types'

export type ProjectTimeLogDialogProps = ProjectTimeLogDialogParams & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectTimeLogDialog(props: ProjectTimeLogDialogProps) {
  const { open, onOpenChange, ...rest } = props

  const state = useProjectTimeLogDialog({
    ...(rest as ProjectTimeLogDialogParams),
    onOpenChange,
  })

  return (
    <>
      <Dialog open={open} onOpenChange={state.handleDialogOpenChange}>
        <DialogContent className='w-full max-w-xl'>
          <DialogHeader>
            <DialogTitle>Add time log</DialogTitle>
            <DialogDescription>
              Entries logged here are reflected immediately in the burndown
              overview for {state.projectLabel}.
            </DialogDescription>
          </DialogHeader>
          <ProjectTimeLogForm
            canLogTime={state.canLogTime}
            canSelectUser={state.canSelectUser}
            isMutating={state.isMutating}
            disableCreate={state.disableCreate}
            formErrors={state.formErrors}
            fieldErrorIds={state.fieldErrorIds}
            hoursInput={state.hoursInput}
            onHoursChange={state.onHoursChange}
            loggedOnInput={state.loggedOnInput}
            onLoggedOnChange={state.onLoggedOnChange}
            noteInput={state.noteInput}
            onNoteChange={state.onNoteChange}
            selectedUserId={state.selectedUserId}
            onSelectUser={state.onSelectUser}
            userComboboxItems={state.userComboboxItems}
            getToday={state.getToday}
            handleSubmit={state.handleSubmit}
            availableTasks={state.availableTasks}
            selectedTasks={state.selectedTasks}
            onAddTask={state.onAddTask}
            isTaskPickerOpen={state.isTaskPickerOpen}
            onTaskPickerOpenChange={state.onTaskPickerOpenChange}
            taskPickerButtonDisabled={state.taskPickerButtonDisabled}
            taskPickerReason={state.taskPickerReason}
            requestTaskRemoval={state.requestTaskRemoval}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(state.taskRemovalCandidate)}
        title='Remove linked task?'
        description='The task will no longer be associated with this log entry.'
        confirmLabel='Remove'
        confirmVariant='destructive'
        confirmDisabled={state.isMutating}
        onCancel={state.cancelTaskRemoval}
        onConfirm={state.confirmTaskRemoval}
      />
      <ConfirmDialog
        open={state.overageDialog.isOpen}
        title='Hours exceed client balance'
        description={state.overageDialog.description}
        confirmLabel='Log anyway'
        confirmVariant='destructive'
        confirmDisabled={state.isMutating}
        onCancel={state.overageDialog.cancel}
        onConfirm={state.overageDialog.confirm}
      />
      <ConfirmDialog
        open={state.discardDialog.isOpen}
        title='Discard time log?'
        description='You have unsaved changes. Are you sure you want to discard them?'
        confirmLabel='Discard'
        confirmVariant='destructive'
        confirmDisabled={state.isMutating}
        onCancel={state.discardDialog.cancel}
        onConfirm={state.discardDialog.confirm}
      />
    </>
  )
}
