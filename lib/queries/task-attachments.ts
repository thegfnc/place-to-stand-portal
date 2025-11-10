import 'server-only'

import { eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects, taskAttachments, tasks } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

type AttachmentSelection = {
  id: string
  storagePath: string
  originalName: string
  mimeType: string
  deletedAt: string | null
  task: {
    id: string
    deletedAt: string | null
    projectId: string | null
  } | null
  project: {
    id: string
    clientId: string | null
    deletedAt: string | null
  } | null
}

export type TaskAttachmentDownloadMetadata = {
  id: string
  storagePath: string
  originalName: string
  mimeType: string
}

export async function getTaskAttachmentForDownload(
  user: AppUser,
  attachmentId: string,
): Promise<TaskAttachmentDownloadMetadata> {
  const rows = (await db
    .select({
      id: taskAttachments.id,
      storagePath: taskAttachments.storagePath,
      originalName: taskAttachments.originalName,
      mimeType: taskAttachments.mimeType,
      deletedAt: taskAttachments.deletedAt,
      task: {
        id: tasks.id,
        deletedAt: tasks.deletedAt,
        projectId: tasks.projectId,
      },
      project: {
        id: projects.id,
        clientId: projects.clientId,
        deletedAt: projects.deletedAt,
      },
    })
    .from(taskAttachments)
    .leftJoin(tasks, eq(tasks.id, taskAttachments.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(taskAttachments.id, attachmentId))
    .limit(1)) as AttachmentSelection[]

  const attachment = rows[0]

  if (
    !attachment ||
    attachment.deletedAt ||
    !attachment.task ||
    attachment.task.deletedAt ||
    !attachment.project ||
    attachment.project.deletedAt
  ) {
    throw new NotFoundError('Attachment not found')
  }

  await ensureClientAccessByTaskId(user, attachment.task.id)

  return {
    id: attachment.id,
    storagePath: attachment.storagePath,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
  }
}
