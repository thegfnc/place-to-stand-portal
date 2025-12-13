import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  clients,
  emailMetadata,
  projects,
} from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { matchAndLinkEmail } from '@/lib/email/matcher'

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

  // Emails (owned by current user)
  const email1 = await upsertEmail({
    userId: user.id,
    gmailMessageId: 'test-gmail-msg-1',
    gmailThreadId: 'thread-1',
    fromEmail: 'ceo@acme.com',
    fromName: 'Acme CEO',
    toEmails: [user.email ?? 'user@example.com'],
    ccEmails: [],
    subject: 'Kickoff & SOW',
    snippet: 'Excited to kick off the website project…',
    receivedAt: new Date().toISOString(),
    isRead: false,
    hasAttachments: true,
    labels: ['INBOX'],
  })

  const email2 = await upsertEmail({
    userId: user.id,
    gmailMessageId: 'test-gmail-msg-2',
    gmailThreadId: 'thread-2',
    fromEmail: 'someone@beta.io',
    fromName: 'Beta Someone',
    toEmails: [user.email ?? 'user@example.com'],
    ccEmails: [],
    subject: 'Integration Inquiry',
    snippet: 'We would like to discuss integration options…',
    receivedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    isRead: true,
    hasAttachments: false,
    labels: ['INBOX'],
  })

  const email3 = await upsertEmail({
    userId: user.id,
    gmailMessageId: 'test-gmail-msg-3',
    gmailThreadId: 'thread-3',
    fromEmail: 'random@unknown.com',
    fromName: 'Random Person',
    toEmails: [user.email ?? 'user@example.com'],
    ccEmails: [],
    subject: 'Cold Outreach',
    snippet: 'We have a great offer for you…',
    receivedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    isRead: false,
    hasAttachments: false,
    labels: ['INBOX'],
  })

  // Run matcher for the first two (exact + domain)
  const match1 = await matchAndLinkEmail(user, email1.id)
  const match2 = await matchAndLinkEmail(user, email2.id)

  return NextResponse.json({
    ok: true,
    clients: { acme, beta },
    project: acmeWebsite,
    emails: { email1, email2, email3 },
    matches: { match1, match2 },
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
  const { clientContacts } = await import('@/lib/db/schema')
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

async function upsertEmail(input: {
  userId: string
  gmailMessageId: string
  gmailThreadId?: string | null
  fromEmail: string
  fromName?: string | null
  toEmails?: string[]
  ccEmails?: string[]
  subject?: string | null
  snippet?: string | null
  receivedAt: string
  isRead?: boolean
  hasAttachments?: boolean
  labels?: string[]
}) {
  const existing = await db
    .select()
    .from(emailMetadata)
    .where(and(eq(emailMetadata.userId, input.userId), eq(emailMetadata.gmailMessageId, input.gmailMessageId), isNull(emailMetadata.deletedAt)))
    .limit(1)
  if (existing[0]) return existing[0]
  const [row] = await db
    .insert(emailMetadata)
    .values({
      userId: input.userId,
      gmailMessageId: input.gmailMessageId,
      gmailThreadId: input.gmailThreadId ?? null,
      subject: input.subject ?? null,
      snippet: input.snippet ?? null,
      fromEmail: input.fromEmail,
      fromName: input.fromName ?? null,
      toEmails: input.toEmails ?? [],
      ccEmails: input.ccEmails ?? [],
      receivedAt: input.receivedAt,
      isRead: input.isRead ?? false,
      hasAttachments: input.hasAttachments ?? false,
      labels: input.labels ?? [],
      rawMetadata: {},
    })
    .returning()
  return row
}

