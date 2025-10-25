'use client'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { useTaskSheetState } from '@/lib/projects/task-sheet/use-task-sheet-state'

import { TaskSheetForm } from './_components/task-sheet/task-sheet-form'
import { TaskSheetHeader } from './_components/task-sheet/task-sheet-header'

type TaskSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectWithRelations
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
}

export function TaskSheet(props: TaskSheetProps) {
  const {
    form,
    feedback,
    isPending,
    isDeleteDialogOpen,
    assigneeItems,
    sheetTitle,
    projectName,
    deleteDisabled,
    deleteDisabledReason,
    submitDisabled,
    submitDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    resolveDisabledReason,
    editorKey,
    taskStatuses,
    unassignedValue,
  } = useTaskSheetState(props)

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg'>
          <TaskSheetHeader
            title={sheetTitle}
            description={
              <>
                Task belongs to{' '}
                <span className='font-medium'>{projectName}</span>.
              </>
            }
          />
          <TaskSheetForm
            form={form}
            onSubmit={handleFormSubmit}
            feedback={feedback}
            isPending={isPending}
            canManage={props.canManage}
            assigneeItems={assigneeItems}
            resolveDisabledReason={resolveDisabledReason}
            taskStatuses={taskStatuses}
            unassignedValue={unassignedValue}
            editorKey={editorKey}
            isEditing={Boolean(props.task)}
            onRequestDelete={handleRequestDelete}
            deleteDisabled={deleteDisabled}
            deleteDisabledReason={deleteDisabledReason}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
          />
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Delete task?'
        description='Deleting this task removes it from the project board. Proceed?'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}
