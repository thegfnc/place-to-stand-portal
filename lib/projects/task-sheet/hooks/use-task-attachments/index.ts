'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { buildDefaultAttachments } from './default-attachments'
import {
  UPLOAD_ENDPOINT,
  type AttachmentDraft,
  type AttachmentItem,
  type UseTaskAttachmentsArgs,
  type UseTaskAttachmentsReturn,
} from './types'
import {
  attachmentsAreDirty,
  buildAttachmentSubmission,
  makeAttachmentKey,
  toAttachmentItems,
} from './attachment-transformers'
import { useAttachmentUploader } from './use-attachment-uploader'

export const useTaskAttachments = ({
  task,
  canManage,
  toast,
}: UseTaskAttachmentsArgs): UseTaskAttachmentsReturn => {
  const defaultAttachments = useMemo(
    () => buildDefaultAttachments(task),
    [task]
  )

  const [baselineAttachments, setBaselineAttachments] =
    useState<AttachmentDraft[]>(defaultAttachments)
  const [attachments, setAttachments] =
    useState<AttachmentDraft[]>(defaultAttachments)
  const [attachmentsToRemove, setAttachmentsToRemove] = useState<string[]>([])
  const pendingPathsRef = useRef<Set<string>>(new Set())
  const previewUrlRef = useRef<Map<string, string>>(new Map())
  const loadedTaskIdRef = useRef<string | null>(null)

  const { handleAttachmentUpload, pendingUploadCount, resetPendingUploads } =
    useAttachmentUploader({
      canManage,
      toast,
      setAttachments,
      pendingPathsRef,
      previewUrlRef,
    })

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
      setAttachments(baselineAttachments)
      setAttachmentsToRemove([])
      resetPendingUploads()
    },
    [
      baselineAttachments,
      cleanupPendingAttachments,
      clearPreviewUrls,
      resetPendingUploads,
    ]
  )

  const attachmentsDirty = useMemo(
    () =>
      attachmentsAreDirty(
        attachments,
        baselineAttachments,
        attachmentsToRemove,
      ),
    [attachments, attachmentsToRemove, baselineAttachments],
  )

  useEffect(() => {
    pendingPathsRef.current.clear()
    clearPreviewUrls()
    setBaselineAttachments(defaultAttachments)
    setAttachments(defaultAttachments)
    setAttachmentsToRemove([])
    resetPendingUploads()
    loadedTaskIdRef.current = task?.attachments?.length ? task.id ?? null : null
  }, [
    clearPreviewUrls,
    defaultAttachments,
    resetPendingUploads,
    task?.attachments?.length,
    task?.id,
  ])

  useEffect(() => {
    const taskId = task?.id ?? null

    if (!taskId) {
      return
    }

    if (loadedTaskIdRef.current === taskId) {
      return
    }

    if (task?.attachments?.length) {
      loadedTaskIdRef.current = taskId
      return
    }

    if ((task?.attachmentCount ?? 0) === 0) {
      loadedTaskIdRef.current = taskId
      return
    }

    const controller = new AbortController()

    const loadAttachments = async () => {
      try {
        const response = await fetch(
          `/api/v1/tasks/${taskId}/attachments`,
          {
            method: 'GET',
            credentials: 'include',
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(payload?.error ?? 'Unable to load attachments.')
        }

        const payload = (await response.json()) as {
          attachments?: Array<{
            id: string
            storage_path: string
            original_name: string
            mime_type: string
            file_size: number | null
          }>
        }

        if (controller.signal.aborted) {
          return
        }

        const normalized = (payload.attachments ?? []).map(attachment => ({
          id: attachment.id,
          storagePath: attachment.storage_path,
          originalName: attachment.original_name,
          mimeType: attachment.mime_type,
          fileSize: Number(attachment.file_size ?? 0),
          isPending: false,
          downloadUrl: `/api/storage/task-attachment/${attachment.id}`,
          previewUrl: null,
        }))

        pendingPathsRef.current.clear()
        clearPreviewUrls()
        setBaselineAttachments(normalized)
        setAttachments(normalized)
        setAttachmentsToRemove([])
        resetPendingUploads()
        loadedTaskIdRef.current = taskId
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error('Failed to load task attachments', error)
        loadedTaskIdRef.current = null
      }
    }

    void loadAttachments()

    return () => {
      controller.abort()
    }
  }, [
    clearPreviewUrls,
    resetPendingUploads,
    task?.attachmentCount,
    task?.attachments?.length,
    task?.id,
  ])

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
    [attachments, cleanupPendingAttachments]
  )

  const attachmentItems = useMemo<AttachmentItem[]>(
    () => toAttachmentItems(attachments),
    [attachments],
  )

  const isUploading = pendingUploadCount > 0

  const buildSubmissionPayload = useCallback(
    () => buildAttachmentSubmission(attachments, attachmentsToRemove),
    [attachments, attachmentsToRemove],
  )

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

export type {
  AttachmentItem,
  AttachmentSubmission,
  UseTaskAttachmentsArgs,
  UseTaskAttachmentsReturn,
} from './types'
