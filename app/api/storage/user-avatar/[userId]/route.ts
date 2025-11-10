import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AVATAR_BUCKET, ensureAvatarBucket } from '@/lib/storage/avatar'
import { getUserAvatarPath } from '@/lib/queries/users'
import { HttpError } from '@/lib/errors/http'

const paramsSchema = z.object({
  userId: z.string().uuid(),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  await requireUser()

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const userId = parsedParams.data.userId

  let avatarPath: string

  try {
    avatarPath = await getUserAvatarPath(userId)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load avatar metadata', error)
    return NextResponse.json({ error: 'Unable to load avatar.' }, { status: 500 })
  }

  await ensureAvatarBucket(supabase)

  // Avatar renders at h-8 w-8 (32px), so 2x = 64px width, height auto
  const maxRenderWidth = 32
  const transformWidth = maxRenderWidth * 2 // 64px

  // Generate signed URL with image transform
  // Supabase image transforms work by appending query parameters to the storage URL
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, 3600, {
      // 1 hour expiry
      transform: {
        quality: 80,
        width: transformWidth,
        resize: 'contain',
      },
    })

  if (signedUrlError || !signedUrlData) {
    console.error('Failed to generate signed URL', signedUrlError)
    return NextResponse.json({ error: 'Avatar not found.' }, { status: 404 })
  }

  // Redirect to the transformed image URL
  return NextResponse.redirect(signedUrlData.signedUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
    },
  })
}
