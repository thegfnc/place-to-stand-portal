import 'server-only'

import { and, desc, eq, isNull, inArray, sql, or } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { threads, messages, clients, projects, users } from '@/lib/db/schema'
import { isAdmin } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors/http'
import type { Thread, ThreadSummary, ThreadStatus } from '@/lib/types/messages'

// ─────────────────────────────────────────────────────────────────────────────
// Thread CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getThreadById(user: AppUser, id: string): Promise<Thread | null> {
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, id), isNull(threads.deletedAt)))
    .limit(1)

  if (!thread) return null

  // Access check: admin, owner, or member of linked client/project
  if (!isAdmin(user) && thread.createdBy !== user.id) {
    // For non-admins, could add client_members check here
    // For now, rely on RLS policies
  }

  return thread
}

export async function getThreadByExternalId(
  externalThreadId: string,
  userId: string
): Promise<Thread | null> {
  const [thread] = await db
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.externalThreadId, externalThreadId),
        isNull(threads.deletedAt),
        // Threads are linked via messages, find threads where user has messages
        sql`EXISTS (
          SELECT 1 FROM messages
          WHERE messages.thread_id = ${threads.id}
          AND messages.user_id = ${userId}
          AND messages.deleted_at IS NULL
        )`
      )
    )
    .limit(1)

  return thread ?? null
}

export type CreateThreadInput = {
  clientId?: string | null
  projectId?: string | null
  subject?: string | null
  status?: ThreadStatus
  source: 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM'
  externalThreadId?: string | null
  participantEmails?: string[]
  createdBy?: string | null
  metadata?: Record<string, unknown>
}

export async function createThread(input: CreateThreadInput): Promise<Thread> {
  const [thread] = await db
    .insert(threads)
    .values({
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      subject: input.subject ?? null,
      status: input.status ?? 'OPEN',
      source: input.source,
      externalThreadId: input.externalThreadId ?? null,
      participantEmails: input.participantEmails ?? [],
      createdBy: input.createdBy ?? null,
      metadata: input.metadata ?? {},
    })
    .returning()

  return thread
}

export async function updateThread(
  id: string,
  updates: Partial<Pick<Thread, 'clientId' | 'projectId' | 'subject' | 'status' | 'participantEmails' | 'lastMessageAt' | 'messageCount' | 'metadata'>>
): Promise<Thread> {
  const [updated] = await db
    .update(threads)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.id, id))
    .returning()

  if (!updated) throw new NotFoundError('Thread not found')
  return updated
}

export async function findOrCreateThread(
  externalThreadId: string,
  userId: string,
  defaults: Omit<CreateThreadInput, 'externalThreadId'>
): Promise<{ thread: Thread; created: boolean }> {
  // Try to find existing thread
  const existing = await getThreadByExternalId(externalThreadId, userId)
  if (existing) {
    return { thread: existing, created: false }
  }

  // Create new thread
  const thread = await createThread({
    ...defaults,
    externalThreadId,
  })

  return { thread, created: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread Listing
// ─────────────────────────────────────────────────────────────────────────────

export type ListThreadsOptions = {
  clientId?: string
  projectId?: string
  status?: ThreadStatus
  limit?: number
  offset?: number
}

export async function listThreadsForUser(
  userId: string,
  options: ListThreadsOptions = {}
): Promise<ThreadSummary[]> {
  const { clientId, projectId, status, limit = 50, offset = 0 } = options

  const conditions = [isNull(threads.deletedAt)]

  if (clientId) {
    conditions.push(eq(threads.clientId, clientId))
  }
  if (projectId) {
    conditions.push(eq(threads.projectId, projectId))
  }
  if (status) {
    conditions.push(eq(threads.status, status))
  }

  // User must have at least one message in the thread OR be the creator
  conditions.push(
    or(
      eq(threads.createdBy, userId),
      sql`EXISTS (
        SELECT 1 FROM messages
        WHERE messages.thread_id = ${threads.id}
        AND messages.user_id = ${userId}
        AND messages.deleted_at IS NULL
      )`
    )!
  )

  const threadRows = await db
    .select()
    .from(threads)
    .where(and(...conditions))
    .orderBy(desc(threads.lastMessageAt))
    .limit(limit)
    .offset(offset)

  if (threadRows.length === 0) return []

  // Get client and project names
  const clientIds = [...new Set(threadRows.map(t => t.clientId).filter(Boolean))] as string[]
  const projectIds = [...new Set(threadRows.map(t => t.projectId).filter(Boolean))] as string[]

  const [clientRows, projectRows] = await Promise.all([
    clientIds.length > 0
      ? db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
      : [],
    projectIds.length > 0
      ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
      : [],
  ])

  const clientMap = new Map(clientRows.map(c => [c.id, c]))
  const projectMap = new Map(projectRows.map(p => [p.id, p]))

  // Get latest message for each thread
  const threadIds = threadRows.map(t => t.id)
  const latestMessages = await db
    .select({
      threadId: messages.threadId,
      id: messages.id,
      snippet: messages.snippet,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      sentAt: messages.sentAt,
      isInbound: messages.isInbound,
      isRead: messages.isRead,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.threadId, threadIds),
        isNull(messages.deletedAt),
        sql`${messages.sentAt} = (
          SELECT MAX(m2.sent_at)
          FROM messages m2
          WHERE m2.thread_id = ${messages.threadId}
          AND m2.deleted_at IS NULL
        )`
      )
    )

  const latestMessageMap = new Map(latestMessages.map(m => [m.threadId, m]))

  return threadRows.map(thread => ({
    id: thread.id,
    subject: thread.subject,
    status: thread.status as ThreadStatus,
    source: thread.source as 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM',
    participantEmails: thread.participantEmails,
    lastMessageAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    client: thread.clientId ? clientMap.get(thread.clientId) ?? null : null,
    project: thread.projectId ? projectMap.get(thread.projectId) ?? null : null,
    latestMessage: latestMessageMap.get(thread.id) ?? null,
  }))
}

export async function listThreadsForClient(
  clientId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ThreadSummary[]> {
  const { limit = 50, offset = 0 } = options

  const threadRows = await db
    .select()
    .from(threads)
    .where(and(eq(threads.clientId, clientId), isNull(threads.deletedAt)))
    .orderBy(desc(threads.lastMessageAt))
    .limit(limit)
    .offset(offset)

  if (threadRows.length === 0) return []

  // Get project names
  const projectIds = [...new Set(threadRows.map(t => t.projectId).filter(Boolean))] as string[]

  const projectRows = projectIds.length > 0
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
    : []

  const projectMap = new Map(projectRows.map(p => [p.id, p]))

  // Get client info
  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)

  // Get latest message for each thread
  const threadIds = threadRows.map(t => t.id)
  const latestMessages = await db
    .select({
      threadId: messages.threadId,
      id: messages.id,
      snippet: messages.snippet,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      sentAt: messages.sentAt,
      isInbound: messages.isInbound,
      isRead: messages.isRead,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.threadId, threadIds),
        isNull(messages.deletedAt),
        sql`${messages.sentAt} = (
          SELECT MAX(m2.sent_at)
          FROM messages m2
          WHERE m2.thread_id = ${messages.threadId}
          AND m2.deleted_at IS NULL
        )`
      )
    )

  const latestMessageMap = new Map(latestMessages.map(m => [m.threadId, m]))

  return threadRows.map(thread => ({
    id: thread.id,
    subject: thread.subject,
    status: thread.status as ThreadStatus,
    source: thread.source as 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM',
    participantEmails: thread.participantEmails,
    lastMessageAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    client: client ?? null,
    project: thread.projectId ? projectMap.get(thread.projectId) ?? null : null,
    latestMessage: latestMessageMap.get(thread.id) ?? null,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread Counts
// ─────────────────────────────────────────────────────────────────────────────

export async function getThreadCountsForUser(userId: string): Promise<{
  total: number
  unread: number
  byStatus: Record<ThreadStatus, number>
}> {
  const userThreadCondition = or(
    eq(threads.createdBy, userId),
    sql`EXISTS (
      SELECT 1 FROM messages
      WHERE messages.thread_id = ${threads.id}
      AND messages.user_id = ${userId}
      AND messages.deleted_at IS NULL
    )`
  )

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) FILTER (WHERE ${threads.status} = 'OPEN')::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${threads.status} = 'RESOLVED')::int`,
      archived: sql<number>`count(*) FILTER (WHERE ${threads.status} = 'ARCHIVED')::int`,
    })
    .from(threads)
    .where(and(isNull(threads.deletedAt), userThreadCondition))

  // Count unread (threads with unread messages)
  const [unreadResult] = await db
    .select({
      count: sql<number>`count(DISTINCT ${threads.id})::int`,
    })
    .from(threads)
    .innerJoin(messages, eq(messages.threadId, threads.id))
    .where(
      and(
        isNull(threads.deletedAt),
        isNull(messages.deletedAt),
        eq(messages.isRead, false),
        eq(messages.userId, userId)
      )
    )

  return {
    total: counts?.total ?? 0,
    unread: unreadResult?.count ?? 0,
    byStatus: {
      OPEN: counts?.open ?? 0,
      RESOLVED: counts?.resolved ?? 0,
      ARCHIVED: counts?.archived ?? 0,
    },
  }
}
