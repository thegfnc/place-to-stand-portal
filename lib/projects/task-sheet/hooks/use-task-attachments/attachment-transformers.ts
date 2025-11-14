import type {
  AttachmentDraft,
  AttachmentItem,
} from './types'

export const makeAttachmentKey = (attachment: AttachmentDraft) =>
  attachment.id ?? attachment.storagePath

export function toAttachmentItems(
  attachments: AttachmentDraft[],
): AttachmentItem[] {
  return attachments.map(attachment => ({
    key: makeAttachmentKey(attachment),
    id: attachment.id,
    name: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.fileSize,
    isPending: attachment.isPending,
    url: attachment.downloadUrl,
  }))
}

export function attachmentsAreDirty(
  attachments: AttachmentDraft[],
  baselineAttachments: AttachmentDraft[],
  attachmentsToRemove: string[],
): boolean {
  if (attachments.some(attachment => attachment.isPending)) {
    return true
  }

  if (attachmentsToRemove.length) {
    return true
  }

  if (attachments.length !== baselineAttachments.length) {
    return true
  }

  const baselineIds = new Set(
    baselineAttachments
      .map(attachment => attachment.id)
      .filter((id): id is string => Boolean(id)),
  )
  const currentIds = new Set(
    attachments
      .filter(attachment => !attachment.isPending && attachment.id)
      .map(attachment => attachment.id as string),
  )

  if (baselineIds.size !== currentIds.size) {
    return true
  }

  for (const id of baselineIds) {
    if (!currentIds.has(id)) {
      return true
    }
  }

  return false
}

export function buildAttachmentSubmission(
  attachments: AttachmentDraft[],
  attachmentsToRemove: string[],
) {
  const pendingAttachments = attachments.filter(
    attachment => attachment.isPending,
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
}

