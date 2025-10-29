'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
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
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
} from '@/lib/storage/task-attachment-constants'

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

const UPLOAD_ENDPOINT = '/api/uploads/task-attachment'

type AttachmentDraft = {
  id: string | null
  storagePath: string
  originalName: string
  mimeType: string
  fileSize: number
  isPending: boolean
  downloadUrl: string | null
  previewUrl: string | null
}

export type AttachmentItem = {
  key: string
  id: string | null
  name: string
  mimeType: string
  size: number
  isPending: boolean
  url: string | null
}

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
  const taskAttachments = task?.attachments ?? null
  const defaultAttachments = useMemo<AttachmentDraft[]>(() => {
    if (!taskAttachments?.length) {
      return []
    }

    return taskAttachments.map(attachment => ({
      id: attachment.id,
      storagePath: attachment.storage_path,
      originalName: attachment.original_name,
      mimeType: attachment.mime_type,
      fileSize: Number(attachment.file_size ?? 0),
      isPending: false,
      downloadUrl: `/api/storage/task-attachment/${attachment.id}`,
      previewUrl: null,
    }))
  }, [taskAttachments])
  const [attachments, setAttachments] =
    useState<AttachmentDraft[]>(defaultAttachments)
  const [attachmentsToRemove, setAttachmentsToRemove] = useState<string[]>([])
  const [pendingUploadCount, setPendingUploadCount] = useState(0)
  const pendingPathsRef = useRef<Set<string>>(new Set())
  const previewUrlRef = useRef<Map<string, string>>(new Map())

  const cleanupPendingAttachments = useCallback((paths: string[]) => {
    if (!paths.length) {
      return
    }

    void Promise.all(
      paths.map(async path => {
        try {
          await fetch(UPLOAD_ENDPOINT, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
          })
        } catch (error) {
          console.error('Failed to clean up pending attachment', error)
        }
      })
    )
  }, [])

  const clearPreviewUrls = useCallback(() => {
    previewUrlRef.current.forEach(url => {
      URL.revokeObjectURL(url)
    })
    previewUrlRef.current.clear()
  }, [])

  const resetAttachmentsState = useCallback(
    (options?: { preservePending?: boolean }) => {
      const pendingPaths = Array.from(pendingPathsRef.current)
      pendingPathsRef.current.clear()

      if (!options?.preservePending && pendingPaths.length) {
        cleanupPendingAttachments(pendingPaths)
      }

      clearPreviewUrls()
      setAttachments(defaultAttachments)
      setAttachmentsToRemove([])
      setPendingUploadCount(0)
    },
    [cleanupPendingAttachments, clearPreviewUrls, defaultAttachments]
  )

  const attachmentsDirty = useMemo(() => {
    if (attachments.some(attachment => attachment.isPending)) {
      return true
    }

    if (attachmentsToRemove.length) {
      return true
    }

    if (attachments.length !== defaultAttachments.length) {
      return true
    }

    const defaultIds = new Set(
      defaultAttachments
        .map(attachment => attachment.id)
        .filter((id): id is string => Boolean(id))
    )
    const currentIds = new Set(
      attachments
        .filter(attachment => !attachment.isPending && attachment.id)
        .map(attachment => attachment.id as string)
    )

    if (defaultIds.size !== currentIds.size) {
      return true
    }

    for (const id of defaultIds) {
      if (!currentIds.has(id)) {
        return true
      }
    }

    return false
  }, [attachments, attachmentsToRemove, defaultAttachments])

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
        const pendingAttachments = attachments.filter(
          attachment => attachment.isPending
        )
        const attachmentsPayload =
          pendingAttachments.length || attachmentsToRemove.length
            ? {
                toAttach: pendingAttachments.map(attachment => ({
                  path: attachment.storagePath,
                  originalName: attachment.originalName,
                  mimeType: attachment.mimeType,
                  fileSize: attachment.fileSize,
                })),
                toRemove: attachmentsToRemove,
              }
            : undefined
        const result = await saveTask({
          id: task?.id,
          projectId: project.id,
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
      })
    },
    [
      attachments,
      attachmentsToRemove,
      canManage,
      onOpenChange,
      project.id,
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

      resetFormState()
      onOpenChange(false)
    })
  }, [canManage, isPending, onOpenChange, resetFormState, task, toast])

  const makeAttachmentKey = useCallback(
    (attachment: AttachmentDraft) => attachment.id ?? attachment.storagePath,
    []
  )

  const handleAttachmentUpload = useCallback(
    async (fileList: FileList | File[]) => {
      if (!canManage) {
        return
      }

      const files = Array.from(fileList ?? [])

      if (!files.length) {
        return
      }

      for (const file of files) {
        if (
          !ACCEPTED_TASK_ATTACHMENT_MIME_TYPES.includes(
            file.type as (typeof ACCEPTED_TASK_ATTACHMENT_MIME_TYPES)[number]
          )
        ) {
          toast({
            title: 'Unsupported file type',
            description: 'Images, videos, PDFs, and ZIPs are supported.',
            variant: 'destructive',
          })
          continue
        }

        if (file.size > MAX_TASK_ATTACHMENT_FILE_SIZE) {
          toast({
            title: 'File too large',
            description: 'Please choose a smaller attachment.',
            variant: 'destructive',
          })
          continue
        }

        setPendingUploadCount(count => count + 1)

        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch(UPLOAD_ENDPOINT, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              error?: string
            } | null
            throw new Error(payload?.error ?? 'Unable to upload attachment.')
          }

          const payload = (await response.json()) as {
            path: string
            originalName: string
            mimeType: string
            fileSize: number
          }

          const previewUrl = URL.createObjectURL(file)
          pendingPathsRef.current.add(payload.path)
          previewUrlRef.current.set(payload.path, previewUrl)

          setAttachments(prev => [
            ...prev,
            {
              id: null,
              storagePath: payload.path,
              originalName: payload.originalName,
              mimeType: payload.mimeType,
              fileSize: payload.fileSize,
              isPending: true,
              downloadUrl: previewUrl,
              previewUrl,
            },
          ])
        } catch (error) {
          console.error('Attachment upload failed', error)
          toast({
            title: 'Upload failed',
            description:
              error instanceof Error
                ? error.message
                : 'Unable to upload attachment.',
            variant: 'destructive',
          })
        } finally {
          setPendingUploadCount(count => Math.max(count - 1, 0))
        }
      }
    },
    [canManage, toast]
  )

  const handleAttachmentRemove = useCallback(
    (key: string) => {
      const target = attachments.find(
        attachment => makeAttachmentKey(attachment) === key
      )

      if (!target) {
        return
      }

      if (target.isPending) {
        pendingPathsRef.current.delete(target.storagePath)
        cleanupPendingAttachments([target.storagePath])
        if (target.previewUrl) {
          URL.revokeObjectURL(target.previewUrl)
        }
        previewUrlRef.current.delete(target.storagePath)
      } else if (target.id) {
        setAttachmentsToRemove(prev => {
          if (prev.includes(target.id as string)) {
            return prev
          }
          return [...prev, target.id as string]
        })
      }

      setAttachments(prev =>
        prev.filter(attachment => makeAttachmentKey(attachment) !== key)
      )
    },
    [attachments, cleanupPendingAttachments, makeAttachmentKey]
  )

  const attachmentItems = useMemo<AttachmentItem[]>(
    () =>
      attachments.map(attachment => ({
        key: makeAttachmentKey(attachment),
        id: attachment.id,
        name: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.fileSize,
        isPending: attachment.isPending,
        url: attachment.downloadUrl,
      })),
    [attachments, makeAttachmentKey]
  )

  const isUploadingAttachments = pendingUploadCount > 0

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
  const submitDisabled = isPending || !canManage || isUploadingAttachments
  const submitDisabledReason = isUploadingAttachments
    ? 'Please wait for uploads to finish.'
    : resolveDisabledReason(submitDisabled)

  useEffect(() => {
    const pendingPathSet = pendingPathsRef.current
    return () => {
      const pendingPaths = Array.from(pendingPathSet)
      pendingPathSet.clear()
      if (pendingPaths.length) {
        cleanupPendingAttachments(pendingPaths)
      }
      clearPreviewUrls()
    }
  }, [cleanupPendingAttachments, clearPreviewUrls])

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
    attachments: attachmentItems,
    handleAttachmentUpload,
    handleAttachmentRemove,
    isUploadingAttachments,
    acceptedAttachmentTypes: ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
    maxAttachmentSize: MAX_TASK_ATTACHMENT_FILE_SIZE,
    attachmentsDisabledReason,
  }
}
