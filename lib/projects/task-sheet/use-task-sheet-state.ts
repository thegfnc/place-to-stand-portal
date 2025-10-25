'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type UseFormReturn } from 'react-hook-form'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useToast } from '@/components/ui/use-toast'

import { removeTask, saveTask } from '@/app/(dashboard)/projects/actions'

import {
  TASK_STATUSES,
  UNASSIGNED_ASSIGNEE_VALUE,
} from './task-sheet-constants'
import {
  buildAssigneeItems,
  createDefaultValues,
  getDisabledReason,
  normalizeRichTextContent,
} from './task-sheet-utils'
import {
  taskSheetFormSchema,
  type TaskSheetFormValues,
} from './task-sheet-schema'

export type UseTaskSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectWithRelations
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
}

type UseTaskSheetStateReturn = {
  form: UseFormReturn<TaskSheetFormValues>
  feedback: string | null
  isPending: boolean
  isDeleteDialogOpen: boolean
  assigneeItems: ReturnType<typeof buildAssigneeItems>
  sheetTitle: string
  projectName: string
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (next: boolean) => void
  handleFormSubmit: (values: TaskSheetFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  resolveDisabledReason: (disabled: boolean) => string | null
  editorKey: string
  taskStatuses: typeof TASK_STATUSES
  unassignedValue: typeof UNASSIGNED_ASSIGNEE_VALUE
}

export const useTaskSheetState = ({
  open,
  onOpenChange,
  project,
  task,
  canManage,
  admins,
}: UseTaskSheetStateArgs): UseTaskSheetStateReturn => {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const currentAssigneeId = task?.assignees[0]?.user_id ?? null

  const defaultValues = useMemo(
    () => createDefaultValues({ task, currentAssigneeId }),
    [task, currentAssigneeId]
  )

  const form = useForm<TaskSheetFormValues>({
    resolver: zodResolver(taskSheetFormSchema),
    defaultValues,
  })

  const assigneeItems = useMemo(
    () =>
      buildAssigneeItems({
        admins,
        members: project.members,
        currentAssigneeId,
      }),
    [admins, currentAssigneeId, project.members]
  )

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const resetFormState = useCallback(() => {
    form.reset(defaultValues)
    setFeedback(null)
    setIsDeleteDialogOpen(false)
  }, [defaultValues, form])

  useEffect(() => {
    startTransition(() => {
      resetFormState()
    })
  }, [resetFormState, startTransition])

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })
  }, [open, resetFormState, startTransition])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        confirmDiscard(() => {
          startTransition(() => {
            resetFormState()
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(next)
    },
    [confirmDiscard, onOpenChange, resetFormState, startTransition]
  )

  const handleFormSubmit = useCallback(
    (values: TaskSheetFormValues) => {
      if (!canManage) {
        return
      }

      startTransition(async () => {
        setFeedback(null)
        const normalizedDescription = normalizeRichTextContent(
          values.description ?? null
        )
        const result = await saveTask({
          id: task?.id,
          projectId: project.id,
          title: values.title.trim(),
          description: normalizedDescription,
          status: values.status,
          dueOn: values.dueOn ? values.dueOn : null,
          assigneeIds: values.assigneeId ? [values.assigneeId] : [],
        })

        if (result.error) {
          setFeedback(result.error)
          return
        }

        toast({
          title: task ? 'Task updated' : 'Task created',
          description: task
            ? 'Changes saved successfully.'
            : 'The task was added to the project board.',
        })

        resetFormState()
        onOpenChange(false)
      })
    },
    [canManage, onOpenChange, project.id, resetFormState, task, toast]
  )

  const handleRequestDelete = useCallback(() => {
    if (!task?.id || !canManage || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [canManage, isPending, task?.id])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!task?.id || !canManage || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      const result = await removeTask({ taskId: task.id })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      toast({
        title: 'Task deleted',
        description: 'The task has been removed from the board.',
      })

      resetFormState()
      onOpenChange(false)
    })
  }, [canManage, isPending, onOpenChange, resetFormState, task, toast])

  const resolveDisabledReason = useCallback(
    (disabled: boolean) => getDisabledReason(disabled, canManage, isPending),
    [canManage, isPending]
  )

  const deleteDisabled = isPending || !canManage
  const deleteDisabledReason = resolveDisabledReason(deleteDisabled)
  const submitDisabled = isPending || !canManage
  const submitDisabledReason = resolveDisabledReason(submitDisabled)

  return {
    form,
    feedback,
    isPending,
    isDeleteDialogOpen,
    assigneeItems,
    sheetTitle: task ? 'Edit task' : 'Add task',
    projectName: project.name,
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
    editorKey: task ? task.id : 'new-task',
    taskStatuses: TASK_STATUSES,
    unassignedValue: UNASSIGNED_ASSIGNEE_VALUE,
  }
}
