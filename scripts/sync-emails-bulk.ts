import { config } from 'dotenv'
config({ path: '.env.local' })

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, eq, inArray } from 'drizzle-orm'
import { emailMetadata, oauthConnections, users } from '../lib/db/schema'
import * as crypto from 'crypto'
import type { GmailMessage, GmailListResponse, GmailBodyPart } from '../lib/gmail/types'

// Inline encryption functions (matching lib/oauth/encryption.ts)
const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY
  if (!key) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY required')
  return Buffer.from(key, 'base64')
}

function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey()
  const data = Buffer.from(encryptedToken, 'base64')
  // Extract: IV (16 bytes) + AuthTag (16 bytes) + EncryptedData
  const iv = data.subarray(0, 16)
  const authTag = data.subarray(16, 32)
  const encrypted = data.subarray(32)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function encryptToken(token: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

// Inline refresh token function
async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Refresh failed: ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

const queryClient = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
const db = drizzle(queryClient)

const TARGET_EMAILS = 5000
const BATCH_SIZE = 100
const PAGE_SIZE = 500

// Gmail helpers (copied from client.ts since we can't use server-only)
async function getValidAccessToken(userId: string): Promise<string> {
  const [conn] = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE')))
    .limit(1)

  if (!conn) throw new Error('Google account not connected')

  const now = Date.now()
  const exp = conn.accessTokenExpiresAt ? new Date(conn.accessTokenExpiresAt).getTime() : undefined
  const needsRefresh = !!exp && exp - now < 5 * 60 * 1000

  if (!needsRefresh) {
    return decryptToken(conn.accessToken)
  }

  if (!conn.refreshToken) {
    return decryptToken(conn.accessToken)
  }

  const refreshed = await refreshAccessToken(decryptToken(conn.refreshToken))
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const newEncryptedAccess = encryptToken(refreshed.access_token)

  await db
    .update(oauthConnections)
    .set({ accessToken: newEncryptedAccess, accessTokenExpiresAt: newExpiresAt, updatedAt: new Date().toISOString() })
    .where(eq(oauthConnections.id, conn.id))

  return refreshed.access_token
}

async function listMessages(accessToken: string, params?: { maxResults?: number; pageToken?: string }) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  if (params?.maxResults) url.searchParams.set('maxResults', String(params.maxResults))
  if (params?.pageToken) url.searchParams.set('pageToken', params.pageToken)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail list failed: ${await res.text()}`)
  return (await res.json()) as GmailListResponse
}

async function getMessage(accessToken: string, messageId: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`)
  url.searchParams.set('format', 'metadata')
  url.searchParams.set('metadataHeaders', 'From')
  url.searchParams.set('metadataHeaders', 'To')
  url.searchParams.set('metadataHeaders', 'Cc')
  url.searchParams.set('metadataHeaders', 'Subject')
  url.searchParams.set('metadataHeaders', 'Date')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail get failed: ${res.status}`)
  return (await res.json()) as GmailMessage
}

function header(headers: GmailBodyPart['headers'] | undefined, name: string): string | null {
  const found = headers?.find(h => h.name.toLowerCase() === name.toLowerCase())
  return found?.value ?? null
}

function parseEmailAddress(addr: string | null): { email: string; name: string | null } {
  if (!addr) return { email: '', name: null }
  const match = addr.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() }
  return { email: addr.trim().toLowerCase(), name: null }
}

function toMetadataRecord(userId: string, msg: GmailMessage) {
  const headers = msg.payload?.headers || []
  const from = parseEmailAddress(header(headers, 'From'))
  const toRaw = header(headers, 'To') || ''
  const ccRaw = header(headers, 'Cc') || ''

  return {
    userId,
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId || null,
    subject: header(headers, 'Subject'),
    snippet: msg.snippet || null,
    fromEmail: from.email || 'unknown@unknown',
    fromName: from.name,
    toEmails: toRaw.split(',').map(e => parseEmailAddress(e.trim()).email).filter(Boolean),
    ccEmails: ccRaw.split(',').map(e => parseEmailAddress(e.trim()).email).filter(Boolean),
    receivedAt: msg.internalDate
      ? new Date(parseInt(msg.internalDate, 10)).toISOString()
      : new Date().toISOString(),
    isRead: !(msg.labelIds || []).includes('UNREAD'),
    hasAttachments: false,
    labels: msg.labelIds || [],
    rawMetadata: {},
  }
}

async function main() {
  console.log(`Syncing up to ${TARGET_EMAILS} emails...`)

  // Get user
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, 'damonbodine@gmail.com'))
    .limit(1)

  if (!user) {
    console.log('User not found')
    process.exit(1)
  }
  console.log('User:', user.id, user.email)

  const accessToken = await getValidAccessToken(user.id)
  console.log('Got access token')

  let allMessageIds: string[] = []
  let pageToken: string | undefined

  // Paginate to get all message IDs
  console.log('Fetching message IDs...')
  while (allMessageIds.length < TARGET_EMAILS) {
    const listRes = await listMessages(accessToken, { maxResults: PAGE_SIZE, pageToken })
    const messages = listRes.messages || []

    if (messages.length === 0) break

    allMessageIds.push(...messages.map(m => m.id))
    console.log(`  Fetched ${allMessageIds.length} IDs`)

    pageToken = listRes.nextPageToken
    if (!pageToken) break
  }

  allMessageIds = allMessageIds.slice(0, TARGET_EMAILS)
  console.log(`Total IDs to process: ${allMessageIds.length}`)

  // Check which already exist
  const existingSet = new Set<string>()
  for (let i = 0; i < allMessageIds.length; i += 1000) {
    const batch = allMessageIds.slice(i, i + 1000)
    const existing = await db
      .select({ gmailMessageId: emailMetadata.gmailMessageId })
      .from(emailMetadata)
      .where(and(eq(emailMetadata.userId, user.id), inArray(emailMetadata.gmailMessageId, batch)))
    existing.forEach(e => existingSet.add(e.gmailMessageId))
  }

  const newIds = allMessageIds.filter(id => !existingSet.has(id))
  console.log(`Already synced: ${existingSet.size}, New to sync: ${newIds.length}`)

  if (newIds.length === 0) {
    console.log('No new emails to sync')
    await queryClient.end()
    return
  }

  // Fetch and insert in batches
  let synced = 0
  let errors = 0

  for (let i = 0; i < newIds.length; i += BATCH_SIZE) {
    const batch = newIds.slice(i, i + BATCH_SIZE)
    const messages: GmailMessage[] = []

    // Fetch messages in parallel
    const fetches = await Promise.allSettled(batch.map(id => getMessage(accessToken, id)))
    for (const f of fetches) {
      if (f.status === 'fulfilled') messages.push(f.value)
      else errors++
    }

    if (messages.length > 0) {
      try {
        const records = messages.map(m => toMetadataRecord(user.id, m))
        await db.insert(emailMetadata).values(records).onConflictDoNothing()
        synced += records.length
      } catch (err) {
        console.error('Insert error:', err)
        errors += messages.length
      }
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= newIds.length) {
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, newIds.length)}/${newIds.length} (synced: ${synced}, errors: ${errors})`)
    }
  }

  // Update last sync time
  await db
    .update(oauthConnections)
    .set({ lastSyncAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(oauthConnections.userId, user.id), eq(oauthConnections.provider, 'GOOGLE')))

  console.log(`\nDone! Synced: ${synced}, Errors: ${errors}`)

  // Count total
  const [count] = await db
    .select({ count: emailMetadata.id })
    .from(emailMetadata)
    .where(eq(emailMetadata.userId, user.id))

  console.log(`Total emails in DB: ${count ? 'check DB' : 0}`)

  await queryClient.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
