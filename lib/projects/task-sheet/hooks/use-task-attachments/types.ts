import type { ToastOptions } from '@/components/ui/use-toast'
import type { TaskWithRelations } from '@/lib/types'

export const UPLOAD_ENDPOINT = '/api/uploads/task-attachment'

export type AttachmentDraft = {
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
