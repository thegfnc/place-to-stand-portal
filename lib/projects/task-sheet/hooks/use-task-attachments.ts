'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ToastOptions } from '@/components/ui/use-toast'
import type { TaskWithRelations } from '@/lib/types'
import {
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
} from '@/lib/storage/task-attachment-constants'

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

export type AttachmentSubmission = {
  toAttach: Array<{
    path: string
    originalName: string
    mimeType: string
    fileSize: number
  }>
  toRemove: string[]
}

export type UseTaskAttachmentsArgs = {
  task?: TaskWithRelations
  canManage: boolean
  toast: (options: ToastOptions) => void
}

export type UseTaskAttachmentsReturn = {
  attachmentItems: AttachmentItem[]
  attachmentsDirty: boolean
  isUploading: boolean
  handleAttachmentUpload: (files: FileList | File[]) => void
  handleAttachmentRemove: (key: string) => void
  resetAttachmentsState: (options?: { preservePending?: boolean }) => void
  buildSubmissionPayload: () => AttachmentSubmission | undefined
}

export const useTaskAttachments = ({
  task,
  canManage,
  toast,
}: UseTaskAttachmentsArgs): UseTaskAttachmentsReturn => {
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

  const isUploading = pendingUploadCount > 0

  const buildSubmissionPayload = useCallback(() => {
    const pendingAttachments = attachments.filter(
      attachment => attachment.isPending
    )

    if (!pendingAttachments.length && !attachmentsToRemove.length) {
      return undefined
    }

    return {
      toAttach: pendingAttachments.map(attachment => ({
        path: attachment.storagePath,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
      })),
      toRemove: attachmentsToRemove,
    }
  }, [attachments, attachmentsToRemove])

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
    attachmentItems,
    attachmentsDirty,
    isUploading,
    handleAttachmentUpload,
    handleAttachmentRemove,
    resetAttachmentsState,
    buildSubmissionPayload,
  }
}
