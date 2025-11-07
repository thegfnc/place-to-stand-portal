import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'

const paramsSchema = z.object({
  attachmentId: z.string().uuid(),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ attachmentId: string }> }
) {
  const actor = await requireUser()
  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const attachmentId = parsedParams.data.attachmentId

  const { data: attachment, error } = await supabase
    .from('task_attachments')
    .select(
      `id,
       storage_path,
       original_name,
       mime_type,
       file_size,
       task:tasks (
         id,
         deleted_at,
         project_id,
         project:projects (
           id,
           client_id,
           deleted_at
         )
       )`
    )
    .eq('id', attachmentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('Failed to load attachment metadata', error)
    return NextResponse.json(
      { error: 'Unable to load attachment.' },
      { status: 500 }
    )
  }

  if (!attachment || !attachment.task || attachment.task.deleted_at) {
    return NextResponse.json(
      { error: 'Attachment not found.' },
      { status: 404 }
    )
  }

  if (attachment.task.project?.deleted_at) {
    return NextResponse.json(
      { error: 'Attachment not found.' },
      { status: 404 }
    )
  }

  if (actor.role !== 'ADMIN') {
    const clientId = attachment.task.project?.client_id ?? null

    if (!clientId) {
      return NextResponse.json(
        { error: 'You do not have access to this attachment.' },
        { status: 403 }
      )
    }

    const { data: clientMember } = await supabase
      .from('client_members')
      .select('id')
      .eq('client_id', clientId)
      .eq('user_id', actor.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!clientMember) {
      return NextResponse.json(
        { error: 'You do not have access to this attachment.' },
        { status: 403 }
      )
    }
  }

  await ensureTaskAttachmentBucket(supabase)

  const { data: file, error: downloadError } = await supabase.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .download(attachment.storage_path)

  if (downloadError || !file) {
    console.error('Failed to download attachment', downloadError)
    return NextResponse.json(
      { error: 'Attachment not found.' },
      { status: 404 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)
  const sanitizedName = attachment.original_name.replace(/"/g, '\\"')

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': attachment.mime_type || 'application/octet-stream',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      'Content-Disposition': `inline; filename="${sanitizedName}"`,
    },
  })
}
