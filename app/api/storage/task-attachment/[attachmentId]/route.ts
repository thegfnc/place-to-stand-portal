import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getTaskAttachmentForDownload } from '@/lib/queries/task-attachments'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'
import { HttpError } from '@/lib/errors/http'

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

  let attachment
  try {
    attachment = await getTaskAttachmentForDownload(actor, attachmentId)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load attachment metadata', error)
    return NextResponse.json(
      { error: 'Unable to load attachment.' },
      { status: 500 }
    )
  }

  await ensureTaskAttachmentBucket(supabase)

  const { data: file, error: downloadError } = await supabase.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .download(attachment.storagePath)

  if (downloadError || !file) {
    console.error('Failed to download attachment', downloadError)
    return NextResponse.json(
      { error: 'Attachment not found.' },
      { status: 404 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)
  const sanitizedName = attachment.originalName.replace(/"/g, '\\"')

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      'Content-Disposition': `inline; filename="${sanitizedName}"`,
    },
  })
}
