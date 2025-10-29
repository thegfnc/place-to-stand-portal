import { Buffer } from 'node:buffer'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteAttachmentObject,
  resolveAttachmentExtension,
} from '@/lib/storage/task-attachments'
import {
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
  TASK_ATTACHMENT_BUCKET,
} from '@/lib/storage/task-attachment-constants'
import {
  ensureTaskAttachmentBucket,
  generatePendingAttachmentPath,
  isPendingAttachmentPath,
} from '@/lib/storage/task-attachments'

const deletePayloadSchema = z.object({
  path: z.string().min(1),
})

export async function POST(request: Request) {
  const actor = await requireUser()
  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Attachment file is required.' },
      { status: 400 }
    )
  }

  if (
    !ACCEPTED_TASK_ATTACHMENT_MIME_TYPES.includes(
      file.type as (typeof ACCEPTED_TASK_ATTACHMENT_MIME_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      { error: 'Unsupported file type.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_TASK_ATTACHMENT_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Attachment is too large.' },
      { status: 400 }
    )
  }

  const extension = resolveAttachmentExtension(file.type)

  if (!extension) {
    return NextResponse.json(
      { error: 'Unable to determine file extension.' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServiceClient()

  await ensureTaskAttachmentBucket(supabase)

  const path = generatePendingAttachmentPath({ actorId: actor.id, extension })
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .upload(path, fileBuffer, {
      cacheControl: '0',
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    console.error('Failed to upload task attachment', error)
    return NextResponse.json(
      { error: 'Unable to upload attachment.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    path,
    originalName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  })
}

export async function DELETE(request: Request) {
  const actor = await requireUser()
  const payload = await request.json().catch(() => null)
  const parsed = deletePayloadSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { path } = parsed.data

  if (!isPendingAttachmentPath(path, actor.id) && actor.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'You cannot remove this attachment.' },
      { status: 403 }
    )
  }

  const supabase = getSupabaseServiceClient()

  try {
    await deleteAttachmentObject({ client: supabase, path })
  } catch (error) {
    console.error('Failed to remove pending attachment', error)
    return NextResponse.json(
      { error: 'Unable to remove attachment.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
