import { decryptToken, encryptToken } from '@/lib/oauth/encryption'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { refreshAccessToken } from '@/lib/oauth/google'
import type {
  GmailListResponse,
  GmailMessage,
  NormalizedEmail,
  GmailBodyPart,
  GmailHistoryResponse,
  GmailHistoryType,
} from './types'

/**
 * Error thrown when OAuth token refresh fails and user needs to reconnect
 */
export class OAuthReconnectRequiredError extends Error {
  constructor(
    message: string,
    public readonly connectionId: string,
    public readonly provider: string = 'GOOGLE'
  ) {
    super(message)
    this.name = 'OAuthReconnectRequiredError'
  }
}

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

  // Check if connection is already marked as needing reauth
  if (conn.status === 'EXPIRED' || conn.status === 'REVOKED' || conn.status === 'PENDING_REAUTH') {
    throw new OAuthReconnectRequiredError(
      'Gmail connection needs to be reconnected',
      conn.id,
      'GOOGLE'
    )
  }

  const now = Date.now()
  const exp = conn.accessTokenExpiresAt ? new Date(conn.accessTokenExpiresAt).getTime() : undefined
  const needsRefresh = !!exp && exp - now < 5 * 60 * 1000 // under 5 minutes left

  if (!needsRefresh) {
    return { accessToken: decryptToken(conn.accessToken), expiresAt: exp ? new Date(exp) : null, connectionId: conn.id }
  }

  if (!conn.refreshToken) {
    // No refresh token - mark as needing reauth and throw
    await markConnectionNeedsReauth(conn.id, 'No refresh token available')
    throw new OAuthReconnectRequiredError(
      'Gmail connection expired and cannot be refreshed',
      conn.id,
      'GOOGLE'
    )
  }

  try {
    const refreshed = await refreshAccessToken(decryptToken(conn.refreshToken))
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    const newEncryptedAccess = encryptToken(refreshed.access_token)

    await db
      .update(oauthConnections)
      .set({ accessToken: newEncryptedAccess, accessTokenExpiresAt: newExpiresAt, updatedAt: new Date().toISOString() })
      .where(eq(oauthConnections.id, conn.id))

    return { accessToken: refreshed.access_token, expiresAt: new Date(newExpiresAt), connectionId: conn.id }
  } catch (error) {
    // Token refresh failed - mark connection as needing reauth
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await markConnectionNeedsReauth(conn.id, errorMessage)
    throw new OAuthReconnectRequiredError(
      `Gmail token refresh failed: ${errorMessage}`,
      conn.id,
      'GOOGLE'
    )
  }
}

/**
 * Mark a connection as needing re-authentication
 */
async function markConnectionNeedsReauth(connectionId: string, reason: string): Promise<void> {
  const syncState = {
    lastError: reason,
    lastErrorAt: new Date().toISOString(),
    needsReauth: true,
  }

  await db
    .update(oauthConnections)
    .set({
      status: 'PENDING_REAUTH',
      syncState,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oauthConnections.id, connectionId))
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

/**
 * List history records since a given historyId.
 * Used for incremental sync to get only changes since last sync.
 *
 * @see https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
 * @throws Error with status 404 if historyId is too old (requires full resync)
 */
export async function listHistory(
  userId: string,
  params: {
    startHistoryId: string
    maxResults?: number
    pageToken?: string
    historyTypes?: GmailHistoryType[]
    labelId?: string
  },
  options?: GmailClientOptions
): Promise<GmailHistoryResponse> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history')

  url.searchParams.set('startHistoryId', params.startHistoryId)
  if (params.maxResults) url.searchParams.set('maxResults', String(params.maxResults))
  if (params.pageToken) url.searchParams.set('pageToken', params.pageToken)
  if (params.labelId) url.searchParams.set('labelId', params.labelId)
  if (params.historyTypes?.length) {
    params.historyTypes.forEach(type => url.searchParams.append('historyTypes', type))
  }

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (res.status === 404) {
    // historyId is too old or invalid - caller should trigger full resync
    throw new GmailHistoryExpiredError('History ID expired or invalid, full resync required')
  }

  if (!res.ok) throw new Error(`Gmail history list failed: ${await res.text()}`)
  return (await res.json()) as GmailHistoryResponse
}

/**
 * Custom error for expired historyId (requires full resync)
 */
export class GmailHistoryExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GmailHistoryExpiredError'
  }
}

/**
 * Get user's Gmail profile including current historyId.
 * Used to get initial historyId for new connections.
 */
export async function getProfile(
  userId: string,
  options?: GmailClientOptions
): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number; historyId: string }> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/profile')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail profile failed: ${await res.text()}`)

  return (await res.json()) as {
    emailAddress: string
    messagesTotal: number
    threadsTotal: number
    historyId: string
  }
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

/**
 * Get a message in raw MIME format.
 * Returns the base64url-encoded raw RFC 2822 message.
 */
export async function getMessageRaw(
  userId: string,
  messageId: string,
  options?: GmailClientOptions
): Promise<Buffer> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`)
  url.searchParams.set('format', 'raw')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail get raw failed: ${await res.text()}`)

  const json = (await res.json()) as { raw: string }
  // Gmail returns base64url-encoded data
  const fixed = json.raw.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(fixed, 'base64')
}

/**
 * Get an attachment's binary data.
 * Returns the attachment content as a Buffer.
 */
export async function getAttachment(
  userId: string,
  messageId: string,
  attachmentId: string,
  options?: GmailClientOptions
): Promise<Buffer> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`
  )

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail get attachment failed: ${await res.text()}`)

  const json = (await res.json()) as { data: string; size: number }
  // Gmail returns base64url-encoded data
  const fixed = json.data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(fixed, 'base64')
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

function collectHtml(part?: GmailBodyPart): string {
  if (!part) return ''
  const thisPart = part.mimeType === 'text/html' ? decodeBase64Url(part.body?.data) : ''
  const children = (part.parts || []).map(p => collectHtml(p)).join('')
  return [thisPart, children].filter(Boolean).join('')
}

/**
 * Mark a message as read in Gmail by removing the UNREAD label
 */
export async function markGmailMessageAsRead(
  userId: string,
  messageId: string,
  options?: GmailClientOptions
): Promise<void> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      removeLabelIds: ['UNREAD'],
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Gmail mark as read failed: ${errorText}`)
  }
}

/**
 * Mark a message as unread in Gmail by adding the UNREAD label
 */
export async function markGmailMessageAsUnread(
  userId: string,
  messageId: string,
  options?: GmailClientOptions
): Promise<void> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      addLabelIds: ['UNREAD'],
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Gmail mark as unread failed: ${errorText}`)
  }
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
  const bodyHtml = collectHtml(message.payload)

  return {
    id: message.id,
    subject,
    from,
    to,
    cc,
    date,
    snippet: message.snippet,
    bodyText: bodyText || undefined,
    bodyHtml: bodyHtml || undefined,
  }
}

export type CidAttachmentMapping = {
  contentId: string // e.g., "image001.png@01DC742D.48FFDB70"
  attachmentId: string // Gmail attachment ID
  mimeType: string
  filename?: string
}

/**
 * Extract CID (Content-ID) to Gmail attachment ID mapping from a message.
 * This is used to resolve inline images referenced via cid: URLs.
 */
function collectCidMappings(part?: GmailBodyPart): CidAttachmentMapping[] {
  if (!part) return []

  const mappings: CidAttachmentMapping[] = []

  // Check if this part has a Content-ID header (indicates inline attachment)
  const contentId = header(part.headers, 'Content-ID')
  const attachmentId = part.body?.attachmentId

  if (contentId && attachmentId) {
    // Content-ID is typically wrapped in angle brackets: <image001.png@xxx>
    const cleanContentId = contentId.replace(/^<|>$/g, '')
    mappings.push({
      contentId: cleanContentId,
      attachmentId,
      mimeType: part.mimeType || 'application/octet-stream',
      filename: part.filename || undefined,
    })
  }

  // Recursively check child parts
  if (part.parts) {
    for (const child of part.parts) {
      mappings.push(...collectCidMappings(child))
    }
  }

  return mappings
}

/**
 * Get the CID to attachment mapping for a Gmail message.
 * Returns a map of content IDs to their proxy URLs.
 */
export function getCidAttachmentMappings(message: GmailMessage): CidAttachmentMapping[] {
  return collectCidMappings(message.payload)
}

export type AttachmentMetadata = {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  contentId?: string // For inline attachments
  isInline: boolean
}

/**
 * Collect all attachment metadata from a message's MIME structure.
 */
function collectAttachments(part?: GmailBodyPart): AttachmentMetadata[] {
  if (!part) return []

  const attachments: AttachmentMetadata[] = []

  // Check if this part is an attachment
  const attachmentId = part.body?.attachmentId
  const size = part.body?.size ?? 0

  if (attachmentId && size > 0) {
    const contentId = header(part.headers, 'Content-ID')
    const contentDisposition = header(part.headers, 'Content-Disposition') || ''

    // Inline if it has a Content-ID or Content-Disposition: inline
    const isInline = !!contentId || contentDisposition.toLowerCase().includes('inline')

    attachments.push({
      attachmentId,
      filename: part.filename || 'unnamed',
      mimeType: part.mimeType || 'application/octet-stream',
      size,
      contentId: contentId?.replace(/^<|>$/g, ''),
      isInline,
    })
  }

  // Recursively check child parts
  if (part.parts) {
    for (const child of part.parts) {
      attachments.push(...collectAttachments(child))
    }
  }

  return attachments
}

/**
 * Get all attachment metadata for a Gmail message.
 * Returns metadata for both inline and regular attachments.
 */
export function getAttachmentMetadata(message: GmailMessage): AttachmentMetadata[] {
  return collectAttachments(message.payload)
}

// =============================================================================
// SEND EMAIL FUNCTIONS
// =============================================================================

export interface SendEmailAttachment {
  filename: string
  mimeType: string
  content: Buffer
}

export interface SendEmailParams {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyHtml?: string
  bodyText?: string
  attachments?: SendEmailAttachment[]
  /** For replies: the Gmail thread ID to keep message in same thread */
  threadId?: string
  /** For replies: Message-ID header of the email being replied to */
  inReplyTo?: string
  /** For replies: References header chain */
  references?: string[]
}

export interface SendEmailResult {
  id: string
  threadId: string
  labelIds: string[]
}

/**
 * Build an RFC 2822 MIME message for sending via Gmail.
 * Handles multipart/mixed for attachments and multipart/alternative for HTML+text.
 */
export function buildMimeMessage(
  from: string,
  params: SendEmailParams
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const lines: string[] = []

  // Headers
  lines.push(`From: ${from}`)
  lines.push(`To: ${params.to.join(', ')}`)
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(', ')}`)
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(', ')}`)
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`)
  lines.push(`MIME-Version: 1.0`)

  // Threading headers for replies
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`)
  }
  if (params.references?.length) {
    lines.push(`References: ${params.references.join(' ')}`)
  }

  const hasAttachments = params.attachments && params.attachments.length > 0
  const hasHtml = !!params.bodyHtml
  const hasText = !!params.bodyText

  if (hasAttachments) {
    // multipart/mixed for attachments
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)

    if (hasHtml && hasText) {
      // multipart/alternative for HTML + text
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
      lines.push('')
      lines.push(`--${altBoundary}`)
      lines.push('Content-Type: text/plain; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyText || '').toString('base64'))
      lines.push(`--${altBoundary}`)
      lines.push('Content-Type: text/html; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyHtml || '').toString('base64'))
      lines.push(`--${altBoundary}--`)
    } else if (hasHtml) {
      lines.push('Content-Type: text/html; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyHtml || '').toString('base64'))
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyText || '').toString('base64'))
    }

    // Add attachments
    for (const att of params.attachments!) {
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      lines.push('')
      lines.push(att.content.toString('base64'))
    }
    lines.push(`--${boundary}--`)
  } else if (hasHtml && hasText) {
    // multipart/alternative for HTML + text (no attachments)
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
    lines.push('')
    lines.push(`--${altBoundary}`)
    lines.push('Content-Type: text/plain; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyText!).toString('base64'))
    lines.push(`--${altBoundary}`)
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyHtml!).toString('base64'))
    lines.push(`--${altBoundary}--`)
  } else if (hasHtml) {
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyHtml!).toString('base64'))
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyText || '').toString('base64'))
  }

  return lines.join('\r\n')
}

/**
 * Send an email via Gmail API.
 * Returns the sent message ID and thread ID.
 */
export async function sendEmail(
  userId: string,
  params: SendEmailParams,
  options?: GmailClientOptions
): Promise<SendEmailResult> {
  const { accessToken, connectionId } = await getValidAccessToken(userId, options?.connectionId)

  // Get sender email from connection
  const conn = await getGoogleConnection(userId, connectionId)
  if (!conn?.providerEmail) {
    throw new Error('Cannot send email: no sender email found for connection')
  }

  const mimeMessage = buildMimeMessage(conn.providerEmail, params)

  // Base64url encode the message
  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const body: { raw: string; threadId?: string } = { raw: encodedMessage }
  if (params.threadId) {
    body.threadId = params.threadId
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Gmail send failed: ${errorText}`)
  }

  const result = (await res.json()) as SendEmailResult
  return result
}

// =============================================================================
// GMAIL DRAFT FUNCTIONS
// =============================================================================

export interface GmailDraft {
  id: string
  message: {
    id: string
    threadId: string
  }
}

export interface GmailDraftListResponse {
  drafts?: GmailDraft[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

/**
 * List drafts in the user's Gmail account.
 */
export async function listDrafts(
  userId: string,
  params?: { maxResults?: number; pageToken?: string },
  options?: GmailClientOptions
): Promise<GmailDraftListResponse> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const searchParams = new URLSearchParams()
  if (params?.maxResults) searchParams.set('maxResults', String(params.maxResults))
  if (params?.pageToken) searchParams.set('pageToken', params.pageToken)

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/drafts?${searchParams.toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to list drafts: ${errorText}`)
  }

  return res.json()
}

/**
 * Get a specific draft by ID.
 */
export async function getDraft(
  userId: string,
  draftId: string,
  options?: GmailClientOptions
): Promise<{ id: string; message: GmailMessage }> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get draft: ${errorText}`)
  }

  return res.json()
}

/**
 * Create a new draft in Gmail.
 */
export async function createGmailDraft(
  userId: string,
  params: SendEmailParams,
  options?: GmailClientOptions
): Promise<GmailDraft> {
  const { accessToken, connectionId } = await getValidAccessToken(userId, options?.connectionId)

  // Get sender email from connection
  const conn = await getGoogleConnection(userId, connectionId)
  if (!conn?.providerEmail) {
    throw new Error('Cannot create draft: no sender email found for connection')
  }

  const mimeMessage = buildMimeMessage(conn.providerEmail, params)

  // Base64url encode the message
  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const body: { message: { raw: string; threadId?: string } } = {
    message: { raw: encodedMessage },
  }
  if (params.threadId) {
    body.message.threadId = params.threadId
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to create draft: ${errorText}`)
  }

  return res.json()
}

/**
 * Update an existing draft in Gmail.
 */
export async function updateGmailDraft(
  userId: string,
  draftId: string,
  params: SendEmailParams,
  options?: GmailClientOptions
): Promise<GmailDraft> {
  const { accessToken, connectionId } = await getValidAccessToken(userId, options?.connectionId)

  // Get sender email from connection
  const conn = await getGoogleConnection(userId, connectionId)
  if (!conn?.providerEmail) {
    throw new Error('Cannot update draft: no sender email found for connection')
  }

  const mimeMessage = buildMimeMessage(conn.providerEmail, params)

  // Base64url encode the message
  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const body: { message: { raw: string; threadId?: string } } = {
    message: { raw: encodedMessage },
  }
  if (params.threadId) {
    body.message.threadId = params.threadId
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to update draft: ${errorText}`)
  }

  return res.json()
}

/**
 * Delete a draft from Gmail.
 */
export async function deleteGmailDraft(
  userId: string,
  draftId: string,
  options?: GmailClientOptions
): Promise<void> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to delete draft: ${errorText}`)
  }
}

/**
 * Send a draft (moves it from drafts to sent).
 */
export async function sendGmailDraft(
  userId: string,
  draftId: string,
  options?: GmailClientOptions
): Promise<SendEmailResult> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: draftId }),
    }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to send draft: ${errorText}`)
  }

  return res.json()
}

// =============================================================================
// GMAIL SIGNATURE FUNCTIONS
// =============================================================================

export interface GmailSendAsSettings {
  sendAsEmail: string
  displayName: string
  replyToAddress?: string
  signature?: string
  isPrimary?: boolean
  treatAsAlias?: boolean
  verificationStatus?: 'accepted' | 'pending'
  isDefault?: boolean
}

export interface GmailSendAsListResponse {
  sendAs: GmailSendAsSettings[]
}

/**
 * Get all send-as addresses and their signatures for the user.
 * This fetches the user's email aliases and signatures from Gmail settings.
 */
export async function getSendAsSettings(
  userId: string,
  options?: GmailClientOptions
): Promise<GmailSendAsSettings[]> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get send-as settings: ${errorText}`)
  }

  const data = (await res.json()) as GmailSendAsListResponse
  return data.sendAs || []
}

/**
 * Get signature for a specific send-as email address.
 */
export async function getSignature(
  userId: string,
  sendAsEmail: string,
  options?: GmailClientOptions
): Promise<GmailSendAsSettings> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(sendAsEmail)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get signature: ${errorText}`)
  }

  return res.json()
}

/**
 * Update signature for a specific send-as email address.
 * Note: This requires the gmail.settings.basic scope.
 */
export async function updateSignature(
  userId: string,
  sendAsEmail: string,
  signature: string,
  options?: GmailClientOptions
): Promise<GmailSendAsSettings> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(sendAsEmail)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ signature }),
    }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to update signature: ${errorText}`)
  }

  return res.json()
}

