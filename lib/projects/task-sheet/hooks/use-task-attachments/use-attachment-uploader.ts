import { useCallback, useState } from 'react'

import {
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
} from '@/lib/storage/task-attachment-constants'

import type { AttachmentDraft } from './types'
import { UPLOAD_ENDPOINT } from './types'

type UseAttachmentUploaderArgs = {
  canManage: boolean
  toast: (options: {
    title: string
    description: string
    variant?: 'default' | 'destructive'
  }) => void
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentDraft[]>>
  pendingPathsRef: React.MutableRefObject<Set<string>>
  previewUrlRef: React.MutableRefObject<Map<string, string>>
}

export function useAttachmentUploader({
  canManage,
  toast,
  setAttachments,
  pendingPathsRef,
  previewUrlRef,
}: UseAttachmentUploaderArgs) {
  const [pendingUploadCount, setPendingUploadCount] = useState(0)
  const resetPendingUploads = useCallback(() => {
    setPendingUploadCount(0)
  }, [])

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
            file.type as (typeof ACCEPTED_TASK_ATTACHMENT_MIME_TYPES)[number],
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
    [canManage, toast, pendingPathsRef, previewUrlRef, setAttachments],
  )

  return {
    handleAttachmentUpload,
    pendingUploadCount,
    resetPendingUploads,
  }
}

