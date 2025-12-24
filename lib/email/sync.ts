import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { emailMetadata, oauthConnections } from '@/lib/db/schema'
import { listMessages, getMessage, normalizeEmail } from '@/lib/gmail/client'
import type { GmailMessage } from '@/lib/gmail/types'

const BATCH_SIZE = 50
const MAX_SYNC = 500

type SyncResult = { synced: number; skipped: number; errors: string[] }

/** Parse "Name <email>" or just "email" format */
function parseEmailAddress(addr: string | null): { email: string; name: string | null } {
  if (!addr) return { email: '', name: null }
  const match = addr.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() }
  return { email: addr.trim().toLowerCase(), name: null }
}

/** Convert Gmail message to email_metadata insert format */
function toMetadataRecord(userId: string, msg: GmailMessage) {
  const norm = normalizeEmail(msg)
  const from = parseEmailAddress(norm.from)
  const hasAttachments = checkAttachments(msg.payload)

  return {
    userId,
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId || null,
    subject: norm.subject,
    snippet: norm.snippet || null,
    fromEmail: from.email || 'unknown@unknown',
    fromName: from.name,
    toEmails: norm.to.map(e => parseEmailAddress(e).email).filter(Boolean),
    ccEmails: norm.cc.map(e => parseEmailAddress(e).email).filter(Boolean),
    receivedAt: msg.internalDate
      ? new Date(parseInt(msg.internalDate, 10)).toISOString()
      : new Date().toISOString(),
    isRead: !(msg.labelIds || []).includes('UNREAD'),
    hasAttachments,
    labels: msg.labelIds || [],
    rawMetadata: {},
  }
}

function checkAttachments(payload?: GmailMessage['payload']): boolean {
  if (!payload) return false
  if (payload.filename && payload.body?.size) return true
  return (payload.parts || []).some(checkAttachments)
}

/** Sync Gmail messages for a single user */
export async function syncGmailForUser(userId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: [] }

  // List recent messages
  const listRes = await listMessages(userId, { maxResults: MAX_SYNC })
  const messageRefs = listRes.messages || []
  if (messageRefs.length === 0) return result

  const gmailIds = messageRefs.map(m => m.id)

  // Check which already exist
  const existing = await db
    .select({ gmailMessageId: emailMetadata.gmailMessageId })
    .from(emailMetadata)
    .where(and(eq(emailMetadata.userId, userId), inArray(emailMetadata.gmailMessageId, gmailIds)))

  const existingSet = new Set(existing.map(e => e.gmailMessageId))
  const newIds = gmailIds.filter(id => !existingSet.has(id))
  result.skipped = existingSet.size

  if (newIds.length === 0) return result

  // Fetch and insert in batches
  for (let i = 0; i < newIds.length; i += BATCH_SIZE) {
    const batch = newIds.slice(i, i + BATCH_SIZE)
    const messages: GmailMessage[] = []

    // Fetch messages (parallel within batch)
    const fetches = await Promise.allSettled(batch.map(id => getMessage(userId, id)))
    for (const f of fetches) {
      if (f.status === 'fulfilled') messages.push(f.value)
      else result.errors.push(f.reason?.message || 'fetch error')
    }

    if (messages.length === 0) continue

    // Insert batch
    try {
      const records = messages.map(m => toMetadataRecord(userId, m))
      await db.insert(emailMetadata).values(records).onConflictDoNothing()
      result.synced += records.length
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : 'insert error')
    }
  }

  // Update last sync time
  await db
    .update(oauthConnections)
    .set({ lastSyncAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE')))

  return result
}

/** Get sync status for a user */
export async function getEmailSyncStatus(userId: string) {
  const [[connection], [stats]] = await Promise.all([
    db
      .select({ lastSyncAt: oauthConnections.lastSyncAt })
      .from(oauthConnections)
      .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE'), isNull(oauthConnections.deletedAt)))
      .limit(1),
    db
      .select({ count: emailMetadata.id })
      .from(emailMetadata)
      .where(and(eq(emailMetadata.userId, userId), isNull(emailMetadata.deletedAt))),
  ])

  return {
    connected: !!connection,
    lastSyncAt: connection?.lastSyncAt ?? null,
    totalEmails: stats ? 1 : 0, // Will fix count below
  }
}
