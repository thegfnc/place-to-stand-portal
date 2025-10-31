import type { TaskWithRelations } from '@/lib/types'

import type { AttachmentDraft } from './types'

export const buildDefaultAttachments = (
  task?: TaskWithRelations
): AttachmentDraft[] => {
  const taskAttachments = task?.attachments ?? null

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
}
