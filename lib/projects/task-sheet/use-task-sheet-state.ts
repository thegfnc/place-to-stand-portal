'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { UseFormReturn } from 'react-hook-form'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useToast } from '@/components/ui/use-toast'

import { removeTask, saveTask } from '@/app/(dashboard)/projects/actions'
import {
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
} from '@/lib/storage/task-attachment-constants'

import {
  TASK_STATUSES,
  UNASSIGNED_ASSIGNEE_VALUE,
} from './task-sheet-constants'
import {
  buildAssigneeItems,
  buildProjectItems,
  getDisabledReason,
  normalizeRichTextContent,
} from './task-sheet-utils'
import type {
  ProjectSelectionItems,
} from './task-sheet-utils'
import type { TaskSheetFormValues } from './task-sheet-schema'
import { useTaskSheetForm } from './hooks/use-task-sheet-form'
import {
  useTaskAttachments,
  type AttachmentItem,
} from './hooks/use-task-attachments'

export type { AttachmentItem } from './hooks/use-task-attachments'

export type UseTaskSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  projects: ProjectWithRelations[]
  projectSelectionProjects?: ProjectWithRelations[]
  defaultProjectId: string | null
  defaultAssigneeId: string | null
}

type UseTaskSheetStateReturn = {
  form: UseFormReturn<TaskSheetFormValues>
  feedback: string | null
  isPending: boolean
  isDeleteDialogOpen: boolean
  assigneeItems: ReturnType<typeof buildAssigneeItems>
  projectItems: ProjectSelectionItems['items']
  projectGroups: ProjectSelectionItems['groups']
  sheetTitle: string
  projectName: string | null
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
  attachments: AttachmentItem[]
  handleAttachmentUpload: (files: FileList | File[]) => void
  handleAttachmentRemove: (key: string) => void
  isUploadingAttachments: boolean
  acceptedAttachmentTypes: readonly string[]
  maxAttachmentSize: number
  attachmentsDisabledReason: string | null
}

export const useTaskSheetState = ({
  open,
  onOpenChange,
  task,
  canManage,
  admins,
  defaultStatus,
  defaultDueOn,
  projects,
  projectSelectionProjects,
  defaultProjectId,
  defaultAssigneeId,
}: UseTaskSheetStateArgs): UseTaskSheetStateReturn => {
  const router = useRouter()
  const pathname = usePathname()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const pendingRefreshRef = useRef(false)
  const previousPathnameRef = useRef(pathname)

  const selectionProjects = projectSelectionProjects ?? projects

  const projectLookup = useMemo(() => {
    return new Map(selectionProjects.map(project => [project.id, project]))
  }, [selectionProjects])

  const {
    form,
    defaultValues,
    sheetTitle,
    editorKey,
  } = useTaskSheetForm({
    task,
    defaultStatus,
    defaultDueOn,
    defaultProjectId,
    defaultAssigneeId,
  })
  const {
    attachmentItems,
    attachmentsDirty,
    isUploading,
    handleAttachmentUpload,
    handleAttachmentRemove,
    resetAttachmentsState,
    buildSubmissionPayload,
  } = useTaskAttachments({
    task,
    canManage,
    toast,
  })

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({
      isDirty: form.formState.isDirty || attachmentsDirty,
    })

  const resetFormState = useCallback(
    (options?: { preservePending?: boolean }) => {
      form.reset(defaultValues)
      setFeedback(null)
      setIsDeleteDialogOpen(false)
      resetAttachmentsState(options)
    },
    [defaultValues, form, resetAttachmentsState]
  )

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

  // Refresh data after sheet closes and URL has been updated (taskId removed)
  useEffect(() => {
    if (!open && pendingRefreshRef.current) {
      // Check if pathname changed (navigation completed)
      if (pathname !== previousPathnameRef.current) {
        pendingRefreshRef.current = false
        // Small delay to ensure navigation is fully complete
        setTimeout(() => {
          router.refresh()
        }, 50)
      }
    }
    // Update previous pathname to track changes
    if (pathname !== previousPathnameRef.current) {
      previousPathnameRef.current = pathname
    }
  }, [open, pathname, router])

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
        const attachmentsPayload = buildSubmissionPayload()
        const result = await saveTask({
          id: task?.id,
          projectId: values.projectId,
          title: values.title.trim(),
          description: normalizedDescription,
          status: values.status,
          dueOn: values.dueOn ? values.dueOn : null,
          assigneeIds: values.assigneeId ? [values.assigneeId] : [],
          attachments: attachmentsPayload,
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

        resetFormState({ preservePending: true })
        onOpenChange(false)
        // If editing a task, wait for navigation to complete before refreshing
        // If creating a new task, refresh immediately (no URL change needed)
        if (task) {
          // Mark that we need to refresh after navigation completes
          pendingRefreshRef.current = true
          // Refresh will happen in useEffect after pathname changes (navigation completes)
        } else {
          // For new tasks, refresh immediately since there's no URL change
          setTimeout(() => {
            router.refresh()
          }, 50)
        }
      })
    },
    [
      buildSubmissionPayload,
      canManage,
      onOpenChange,
      router,
      resetFormState,
      task,
      toast,
    ]
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

      router.refresh()
      resetFormState()
      onOpenChange(false)
    })
  }, [canManage, isPending, onOpenChange, resetFormState, router, task, toast])

  const attachmentsDisabledReason = getDisabledReason(
    !canManage || isPending,
    canManage,
    isPending
  )

  const resolveDisabledReason = useCallback(
    (disabled: boolean) => getDisabledReason(disabled, canManage, isPending),
    [canManage, isPending]
  )

  const deleteDisabled = isPending || !canManage
  const deleteDisabledReason = resolveDisabledReason(deleteDisabled)
  const submitDisabled = isPending || !canManage || isUploading
  const submitDisabledReason = isUploading
    ? 'Please wait for uploads to finish.'
    : resolveDisabledReason(submitDisabled)

  const selectedProjectId = form.watch('projectId') ?? ''
  const selectedProject = selectedProjectId
    ? projectLookup.get(selectedProjectId)
    : null
  const { items: projectItems, groups: projectGroups } = useMemo(
    () => buildProjectItems({ projects: selectionProjects }),
    [selectionProjects]
  )
  const watchedAssigneeId = form.watch('assigneeId') ?? null
  const assigneeItems = useMemo(
    () =>
      buildAssigneeItems({
        admins,
        members: selectedProject?.members ?? [],
        currentAssigneeId: watchedAssigneeId,
      }),
    [admins, selectedProject, watchedAssigneeId]
  )
  const projectName = selectedProject?.name ?? null

  return {
    form,
    feedback,
    isPending,
    isDeleteDialogOpen,
    assigneeItems,
    projectItems,
    projectGroups,
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
    taskStatuses: TASK_STATUSES,
    unassignedValue: UNASSIGNED_ASSIGNEE_VALUE,
    attachments: attachmentItems,
    handleAttachmentUpload,
    handleAttachmentRemove,
    isUploadingAttachments: isUploading,
    acceptedAttachmentTypes: ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
    maxAttachmentSize: MAX_TASK_ATTACHMENT_FILE_SIZE,
    attachmentsDisabledReason,
  }
}
