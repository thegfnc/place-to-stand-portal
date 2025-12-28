import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  clients,
  projects,
  threads,
  messages,
  clientContacts,
} from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export async function POST() {
  const user = await requireUser()
  assertAdmin(user)

  // Ensure or create clients
  const acme = await upsertClient({ slug: 'acme', name: 'Acme Corp', createdBy: user.id })
  const beta = await upsertClient({ slug: 'beta-llc', name: 'Beta LLC', createdBy: user.id })

  // Ensure membership for current user
  await ensureMembership(user.id, acme.id)
  await ensureMembership(user.id, beta.id)

  // Ensure or create project under Acme
  const acmeWebsite = await upsertProject({
    slug: 'acme-website',
    name: 'Acme Website',
    clientId: acme.id,
    createdBy: user.id,
  })

  // Contacts
  await upsertContact({ clientId: acme.id, email: 'ceo@acme.com', name: 'Acme CEO', createdBy: user.id })
  await upsertContact({ clientId: acme.id, email: 'dev@acme.com', name: 'Acme Dev', createdBy: user.id })
  await upsertContact({ clientId: beta.id, email: 'team@beta.io', name: 'Beta Team', createdBy: user.id })

  // Create threads and messages (owned by current user)
  const thread1 = await upsertThread({
    clientId: acme.id,
    subject: 'Kickoff & SOW',
    source: 'EMAIL',
    externalThreadId: 'test-thread-1',
    participantEmails: ['ceo@acme.com', user.email ?? 'user@example.com'],
    createdBy: user.id,
  })

  const message1 = await upsertMessage({
    threadId: thread1.id,
    userId: user.id,
    source: 'EMAIL',
    externalMessageId: 'test-gmail-msg-1',
    subject: 'Kickoff & SOW',
    fromEmail: 'ceo@acme.com',
    fromName: 'Acme CEO',
    toEmails: [user.email ?? 'user@example.com'],
    sentAt: new Date().toISOString(),
    snippet: 'Excited to kick off the website project...',
    isInbound: true,
    hasAttachments: true,
  })

  const thread2 = await upsertThread({
    clientId: beta.id,
    subject: 'Integration Inquiry',
    source: 'EMAIL',
    externalThreadId: 'test-thread-2',
    participantEmails: ['someone@beta.io', user.email ?? 'user@example.com'],
    createdBy: user.id,
  })

  const message2 = await upsertMessage({
    threadId: thread2.id,
    userId: user.id,
    source: 'EMAIL',
    externalMessageId: 'test-gmail-msg-2',
    subject: 'Integration Inquiry',
    fromEmail: 'someone@beta.io',
    fromName: 'Beta Someone',
    toEmails: [user.email ?? 'user@example.com'],
    sentAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    snippet: 'We would like to discuss integration options...',
    isInbound: true,
    isRead: true,
    hasAttachments: false,
  })

  // Thread without client link (unknown sender)
  const thread3 = await upsertThread({
    subject: 'Cold Outreach',
    source: 'EMAIL',
    externalThreadId: 'test-thread-3',
    participantEmails: ['random@unknown.com', user.email ?? 'user@example.com'],
    createdBy: user.id,
  })

  const message3 = await upsertMessage({
    threadId: thread3.id,
    userId: user.id,
    source: 'EMAIL',
    externalMessageId: 'test-gmail-msg-3',
    subject: 'Cold Outreach',
    fromEmail: 'random@unknown.com',
    fromName: 'Random Person',
    toEmails: [user.email ?? 'user@example.com'],
    sentAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    snippet: 'We have a great offer for you...',
    isInbound: true,
    hasAttachments: false,
  })

  return NextResponse.json({
    ok: true,
    clients: { acme, beta },
    project: acmeWebsite,
    threads: { thread1, thread2, thread3 },
    messages: { message1, message2, message3 },
  })
}

async function upsertClient(input: { slug: string; name: string; createdBy: string }) {
  const existing = await db
    .select()
    .from(clients)
    .where(and(eq(clients.slug, input.slug), isNull(clients.deletedAt)))
    .limit(1)
  if (existing[0]) return existing[0]

  const [row] = await db
    .insert(clients)
    .values({ slug: input.slug, name: input.name, createdBy: input.createdBy })
    .returning()
  return row
}

async function ensureMembership(userId: string, clientId: string) {
  const existing = await db
    .select({ id: clientMembers.id })
    .from(clientMembers)
    .where(and(eq(clientMembers.userId, userId), eq(clientMembers.clientId, clientId), isNull(clientMembers.deletedAt)))
    .limit(1)
  if (existing[0]) return existing[0]
  const [row] = await db
    .insert(clientMembers)
    .values({ userId, clientId })
    .returning({ id: clientMembers.id })
  return row
}

async function upsertProject(input: { slug: string; name: string; clientId: string; createdBy: string }) {
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, input.slug), isNull(projects.deletedAt)))
    .limit(1)
  if (existing[0]) return existing[0]
  const [row] = await db
    .insert(projects)
    .values({ slug: input.slug, name: input.name, clientId: input.clientId, createdBy: input.createdBy })
    .returning()
  return row
}

async function upsertContact(input: { clientId: string; email: string; name?: string | null; createdBy: string }) {
  const existing = await db
    .select()
    .from(clientContacts)
    .where(and(eq(clientContacts.clientId, input.clientId), eq(clientContacts.email, input.email), isNull(clientContacts.deletedAt)))
    .limit(1)
  if (existing[0]) return existing[0]
  const [row] = await db
    .insert(clientContacts)
    .values({ clientId: input.clientId, email: input.email, name: input.name ?? null, createdBy: input.createdBy })
    .returning()
  return row
}

async function upsertThread(input: {
  clientId?: string | null
  projectId?: string | null
  subject?: string | null
  source: 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM'
  externalThreadId?: string | null
  participantEmails?: string[]
  createdBy?: string | null
}) {
  if (input.externalThreadId) {
    const existing = await db
      .select()
      .from(threads)
      .where(and(eq(threads.externalThreadId, input.externalThreadId), isNull(threads.deletedAt)))
      .limit(1)
    if (existing[0]) return existing[0]
  }

  const [row] = await db
    .insert(threads)
    .values({
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      subject: input.subject ?? null,
      source: input.source,
      externalThreadId: input.externalThreadId ?? null,
      participantEmails: input.participantEmails ?? [],
      createdBy: input.createdBy ?? null,
    })
    .returning()
  return row
}

async function upsertMessage(input: {
  threadId: string
  userId: string
  source: 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM'
  externalMessageId?: string | null
  subject?: string | null
  fromEmail: string
  fromName?: string | null
  toEmails?: string[]
  ccEmails?: string[]
  sentAt: string
  snippet?: string | null
  isInbound?: boolean
  isRead?: boolean
  hasAttachments?: boolean
}) {
  if (input.externalMessageId) {
    const existing = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.userId, input.userId),
          eq(messages.externalMessageId, input.externalMessageId),
          isNull(messages.deletedAt)
        )
      )
      .limit(1)
    if (existing[0]) return existing[0]
  }

  const [row] = await db
    .insert(messages)
    .values({
      threadId: input.threadId,
      userId: input.userId,
      source: input.source,
      externalMessageId: input.externalMessageId ?? null,
      subject: input.subject ?? null,
      fromEmail: input.fromEmail,
      fromName: input.fromName ?? null,
      toEmails: input.toEmails ?? [],
      ccEmails: input.ccEmails ?? [],
      sentAt: input.sentAt,
      snippet: input.snippet ?? null,
      isInbound: input.isInbound ?? true,
      isRead: input.isRead ?? false,
      hasAttachments: input.hasAttachments ?? false,
    })
    .returning()

  // Update thread stats
  await db
    .update(threads)
    .set({
      messageCount: 1, // Simplified for seed
      lastMessageAt: input.sentAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.id, input.threadId))

  return row
}
