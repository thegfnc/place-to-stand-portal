'use client'

import { useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Form } from '@/components/ui/form'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type { TaskSheetFormValues } from '@/lib/projects/task-sheet/task-sheet-schema'
import type { AttachmentItem } from '@/lib/projects/task-sheet/use-task-sheet-state'
import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

import { TaskSheetFormFields } from './task-sheet-form-fields'
import { TaskSheetFormFooter } from './task-sheet-form-footer'

type TaskSheetFormProps = {
  form: UseFormReturn<TaskSheetFormValues>
  onSubmit: (values: TaskSheetFormValues) => void
  feedback: string | null
  isPending: boolean
  canManage: boolean
  assigneeItems: SearchableComboboxItem[]
  projectItems: SearchableComboboxItem[]
  projectGroups: SearchableComboboxGroup[]
  resolveDisabledReason: (disabled: boolean) => string | null
  taskStatuses: Array<{ value: string; label: string }>
  unassignedValue: string
  editorKey: string
  isEditing: boolean
  onRequestDelete: () => void
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  isSheetOpen: boolean
  historyKey: string
  attachments: AttachmentItem[]
  onAttachmentUpload: (files: FileList | File[]) => void
  onAttachmentRemove: (key: string) => void
  isUploadingAttachments: boolean
  acceptedAttachmentTypes: readonly string[]
  maxAttachmentSize: number
  attachmentsDisabledReason: string | null
  isDragActive: boolean
}

export function TaskSheetForm(props: TaskSheetFormProps) {
  const {
    form,
    onSubmit,
    feedback,
    isPending,
    canManage,
    assigneeItems,
    projectItems,
    projectGroups,
    resolveDisabledReason,
    taskStatuses,
    unassignedValue,
    editorKey,
    isEditing,
    onRequestDelete,
    deleteDisabled,
    deleteDisabledReason,
    submitDisabled,
    submitDisabledReason,
    isSheetOpen,
    historyKey,
    attachments,
    onAttachmentUpload,
    onAttachmentRemove,
    isUploadingAttachments,
    acceptedAttachmentTypes,
    maxAttachmentSize,
    attachmentsDisabledReason,
    isDragActive,
  } = props

  const handleSave = useCallback(
    () => form.handleSubmit(onSubmit)(),
    [form, onSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: isSheetOpen,
    canSave: !submitDisabled,
    onSave: handleSave,
    historyKey,
  })

  const saveLabel = useMemo(() => {
    if (isPending) {
      return 'Saving...'
    }

    if (isEditing) {
      return 'Save changes'
    }

    return 'Create task'
  }, [isEditing, isPending])

  const attachmentsDisabled = isPending || !canManage

  const handleFileDialogSelect = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        return
      }
      onAttachmentUpload(fileList)
    },
    [onAttachmentUpload]
  )

  const submitHandler = useMemo(
    () => form.handleSubmit(onSubmit),
    [form, onSubmit]
  )

  return (
    <Form {...form}>
      <form
        onSubmit={submitHandler}
        className='flex flex-1 flex-col gap-6 px-6 pb-4'
      >
        <TaskSheetFormFields
          form={form}
          isPending={isPending}
          canManage={canManage}
          resolveDisabledReason={resolveDisabledReason}
          taskStatuses={taskStatuses}
          assigneeItems={[...assigneeItems]}
          projectItems={projectItems}
          projectGroups={projectGroups}
          unassignedValue={unassignedValue}
          editorKey={editorKey}
          attachments={attachments}
          onSelectFiles={handleFileDialogSelect}
          onAttachmentRemove={onAttachmentRemove}
          attachmentsDisabled={attachmentsDisabled}
          attachmentsDisabledReason={attachmentsDisabledReason}
          isUploadingAttachments={isUploadingAttachments}
          isDragActive={isDragActive}
          acceptedAttachmentTypes={acceptedAttachmentTypes}
          maxAttachmentSize={maxAttachmentSize}
          feedback={feedback}
          isSheetOpen={isSheetOpen}
        />
        <TaskSheetFormFooter
          saveLabel={saveLabel}
          submitDisabled={submitDisabled}
          submitDisabledReason={submitDisabledReason}
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          isEditing={isEditing}
          deleteDisabled={deleteDisabled}
          deleteDisabledReason={deleteDisabledReason}
          onRequestDelete={onRequestDelete}
        />
      </form>
    </Form>
  )
}
