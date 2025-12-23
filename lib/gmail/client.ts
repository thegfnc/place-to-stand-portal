import { decryptToken, encryptToken } from '@/lib/oauth/encryption'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { refreshAccessToken } from '@/lib/oauth/google'
import type { GmailListResponse, GmailMessage, NormalizedEmail, GmailBodyPart } from './types'

type GetAccessTokenResult = { accessToken: string; expiresAt?: Date | null; connectionId: string }

interface GmailClientOptions {
  connectionId?: string
}

/**
 * Get the default Google connection for a user (first connected account)
 */
export async function getDefaultGoogleConnectionId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: oauthConnections.id })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, 'GOOGLE')
      )
    )
    .limit(1)
  return row?.id ?? null
}

async function getGoogleConnection(userId: string, connectionId?: string) {
  if (connectionId) {
    // Get specific connection by ID
    const [row] = await db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.id, connectionId),
          eq(oauthConnections.userId, userId),
          eq(oauthConnections.provider, 'GOOGLE')
        )
      )
      .limit(1)
    return row ?? null
  }

  // Fall back to first connected account
  const [row] = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE')))
    .limit(1)
  return row ?? null
}

export async function getValidAccessToken(
  userId: string,
  connectionId?: string
): Promise<GetAccessTokenResult> {
  const conn = await getGoogleConnection(userId, connectionId)
  if (!conn) throw new Error('Google account not connected')

  const now = Date.now()
  const exp = conn.accessTokenExpiresAt ? new Date(conn.accessTokenExpiresAt).getTime() : undefined
  const needsRefresh = !!exp && exp - now < 5 * 60 * 1000 // under 5 minutes left

  if (!needsRefresh) {
    return { accessToken: decryptToken(conn.accessToken), expiresAt: exp ? new Date(exp) : null, connectionId: conn.id }
  }

  if (!conn.refreshToken) {
    return { accessToken: decryptToken(conn.accessToken), expiresAt: exp ? new Date(exp) : null, connectionId: conn.id }
  }

  const refreshed = await refreshAccessToken(decryptToken(conn.refreshToken))
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const newEncryptedAccess = encryptToken(refreshed.access_token)

  await db
    .update(oauthConnections)
    .set({ accessToken: newEncryptedAccess, accessTokenExpiresAt: newExpiresAt, updatedAt: new Date().toISOString() })
    .where(eq(oauthConnections.id, conn.id))

  return { accessToken: refreshed.access_token, expiresAt: new Date(newExpiresAt), connectionId: conn.id }
}

export async function listMessages(
  userId: string,
  params?: { maxResults?: number; pageToken?: string; q?: string },
  options?: GmailClientOptions
) {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  if (params?.maxResults) url.searchParams.set('maxResults', String(params.maxResults))
  if (params?.pageToken) url.searchParams.set('pageToken', params.pageToken)
  if (params?.q) url.searchParams.set('q', params.q)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail list failed: ${await res.text()}`)
  const json = (await res.json()) as GmailListResponse
  return json
}

export async function getMessage(
  userId: string,
  messageId: string,
  options?: GmailClientOptions
) {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`)
  url.searchParams.set('format', 'full')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail get failed: ${await res.text()}`)
  const json = (await res.json()) as GmailMessage
  return json
}

function header(headers: GmailBodyPart['headers'] | undefined, name: string): string | null {
  const found = headers?.find(h => h.name.toLowerCase() === name.toLowerCase())
  return found?.value ?? null
}

function decodeBase64Url(data?: string): string {
  if (!data) return ''
  // Gmail uses URL-safe base64
  const fixed = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(fixed, 'base64').toString('utf-8')
}

function collectText(part?: GmailBodyPart): string {
  if (!part) return ''
  const thisPart = part.mimeType?.startsWith('text/plain') ? decodeBase64Url(part.body?.data) : ''
  const children = (part.parts || []).map(p => collectText(p)).join('\n')
  return [thisPart, children].filter(Boolean).join('\n')
}

export function normalizeEmail(message: GmailMessage): NormalizedEmail {
  const headers = message.payload?.headers || []
  const subject = header(headers, 'Subject')
  const from = header(headers, 'From')
  const to = (header(headers, 'To') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const cc = (header(headers, 'Cc') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const date = header(headers, 'Date')
  const bodyText = collectText(message.payload)

  return {
    id: message.id,
    subject,
    from,
    to,
    cc,
    date,
    snippet: message.snippet,
    bodyText: bodyText || undefined,
  }
}

