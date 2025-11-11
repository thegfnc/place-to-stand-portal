import 'server-only'

import { randomUUID } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import {
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
  TASK_ATTACHMENT_BUCKET,
} from './task-attachment-constants'

export type TaskAttachmentBucketClient = SupabaseClient<Database>

const PENDING_PREFIX = 'attachments/pending'
const TASK_PREFIX = 'attachments/tasks'

const ACCEPTED_ATTACHMENT_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
}

export function resolveAttachmentExtension(mimeType: string) {
  return ACCEPTED_ATTACHMENT_EXTENSIONS[
    mimeType as keyof typeof ACCEPTED_ATTACHMENT_EXTENSIONS
  ]
}

export function inferAttachmentExtensionFromPath(path: string) {
  const segments = path.split('.')
  return segments.length > 1 ? (segments.pop() ?? null) : null
}

const parseFileSizeLimit = (value: string | number | null | undefined) => {
  if (typeof value === 'number') {
    return value
  }

  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  const unitMatch = normalized.match(/(kb|mb|gb)$/)
  const unit = unitMatch ? unitMatch[1] : null
  const numericPart = unit
    ? normalized.slice(0, -unit.length).trim()
    : normalized
  const numericValue = Number.parseFloat(numericPart)

  if (Number.isNaN(numericValue)) {
    return null
  }

  switch (unit) {
    case 'kb':
      return Math.round(numericValue * 1024)
    case 'mb':
      return Math.round(numericValue * 1024 * 1024)
    case 'gb':
      return Math.round(numericValue * 1024 * 1024 * 1024)
    default:
      return Math.round(numericValue)
  }
}

export async function ensureTaskAttachmentBucket(
  client: TaskAttachmentBucketClient
) {
  const desiredMimeTypes = [...ACCEPTED_TASK_ATTACHMENT_MIME_TYPES]
  const desiredFileSizeLimitLabel = `${Math.floor(MAX_TASK_ATTACHMENT_FILE_SIZE / 1024)}KB`
  const desiredFileSizeLimitBytes = MAX_TASK_ATTACHMENT_FILE_SIZE

  const { data, error } = await client.storage.getBucket(TASK_ATTACHMENT_BUCKET)

  if (data && !error) {
    const currentMimeTypes = Array.isArray(data.allowed_mime_types)
      ? (data.allowed_mime_types as string[])
      : []
    const hasSameMimeTypes =
      currentMimeTypes.length === desiredMimeTypes.length &&
      desiredMimeTypes.every(type => currentMimeTypes.includes(type))
    const currentFileSizeBytes = parseFileSizeLimit(data.file_size_limit)
    const hasSameFileSize = currentFileSizeBytes === desiredFileSizeLimitBytes

    if (!hasSameMimeTypes || !hasSameFileSize) {
      const { error: updateError } = await client.storage.updateBucket(
        TASK_ATTACHMENT_BUCKET,
        {
          public: false,
          fileSizeLimit: desiredFileSizeLimitLabel,
          allowedMimeTypes: desiredMimeTypes,
        }
      )

      if (updateError) {
        throw updateError
      }
    }

    return
  }

  if (error && !error.message?.toLowerCase().includes('not found')) {
    throw error
  }

  const { error: createError } = await client.storage.createBucket(
    TASK_ATTACHMENT_BUCKET,
    {
      public: false,
      fileSizeLimit: desiredFileSizeLimitLabel,
      allowedMimeTypes: desiredMimeTypes,
    }
  )

  if (
    createError &&
    !createError.message?.toLowerCase().includes('already exists')
  ) {
    throw createError
  }
}

export function generatePendingAttachmentPath({
  actorId,
  extension,
}: {
  actorId: string
  extension: string
}) {
  return `${PENDING_PREFIX}/${actorId}/${randomUUID()}.${extension}`
}

export function generateTaskAttachmentPath({
  taskId,
  extension,
}: {
  taskId: string
  extension: string
}) {
  return `${TASK_PREFIX}/${taskId}/${randomUUID()}.${extension}`
}

export function isPendingAttachmentPath(path: string, actorId: string) {
  return path.startsWith(`${PENDING_PREFIX}/${actorId}/`)
}

export function isTaskAttachmentPath(path: string, taskId: string) {
  return path.startsWith(`${TASK_PREFIX}/${taskId}/`)
}

export async function moveAttachmentToTaskFolder({
  client,
  path,
  taskId,
}: {
  client: TaskAttachmentBucketClient
  path: string
  taskId: string
}) {
  if (!path) {
    return null
  }

  if (path.startsWith(`${TASK_PREFIX}/${taskId}/`)) {
    return path
  }

  const extension = inferAttachmentExtensionFromPath(path) ?? 'dat'
  const destination = generateTaskAttachmentPath({ taskId, extension })

  await ensureTaskAttachmentBucket(client)

  const { error } = await client.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .move(path, destination)

  if (error) {
    throw error
  }

  return destination
}

export async function deleteAttachmentObject({
  client,
  path,
}: {
  client: TaskAttachmentBucketClient
  path: string
}) {
  if (!path) {
    return
  }

  await ensureTaskAttachmentBucket(client)

  const { error } = await client.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .remove([path])

  if (error) {
    throw error
  }
}
