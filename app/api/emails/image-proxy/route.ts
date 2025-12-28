import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getValidAccessToken } from '@/lib/gmail/client'

/**
 * Image proxy endpoint to handle:
 * 1. External images (bypass CORS/referrer issues)
 * 2. Gmail attachment images (cid: references)
 *
 * Usage:
 * - External: /api/emails/image-proxy?url=https://example.com/image.png
 * - Attachment: /api/emails/image-proxy?messageId=xxx&attachmentId=yyy
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const externalUrl = searchParams.get('url')
    const messageId = searchParams.get('messageId')
    const attachmentId = searchParams.get('attachmentId')

    // Handle external image proxy
    if (externalUrl) {
      return await proxyExternalImage(externalUrl)
    }

    // Handle Gmail attachment image
    if (messageId && attachmentId) {
      return await fetchGmailAttachment(user.id, messageId, attachmentId)
    }

    return NextResponse.json({ error: 'Missing url or messageId/attachmentId' }, { status: 400 })
  } catch (error) {
    console.error('Image proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}

async function proxyExternalImage(url: string): Promise<NextResponse> {
  // Validate URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EmailClient/1.0)',
      'Accept': 'image/*',
    },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status })
  }

  const contentType = response.headers.get('content-type') || 'image/png'
  const buffer = await response.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
    },
  })
}

async function fetchGmailAttachment(
  userId: string,
  messageId: string,
  attachmentId: string
): Promise<NextResponse> {
  const { accessToken } = await getValidAccessToken(userId)

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: response.status })
  }

  const data = await response.json()

  // Gmail returns base64url encoded data
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
  const buffer = Buffer.from(base64, 'base64')

  // Try to determine content type from the data
  const contentType = detectImageType(buffer) || 'image/png'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

function detectImageType(buffer: Buffer): string | null {
  // Check magic bytes
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif'
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp'
  }
  return null
}
