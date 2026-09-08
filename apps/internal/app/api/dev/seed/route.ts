import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clientMembers,
  clients,
  projects,
  contacts,
  contactClients,
} from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export async function POST() {
  // Hard guard: never available in production (matches dev/make-me-admin)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

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

  return NextResponse.json({
    ok: true,
    clients: { acme, beta },
    project: acmeWebsite,
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
  // Find or create contact by email
  let [existingContact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.email, input.email), isNull(contacts.deletedAt)))
    .limit(1)

  let contactId: string
  if (existingContact) {
    contactId = existingContact.id
  } else {
    const [newContact] = await db
      .insert(contacts)
      .values({ email: input.email, name: input.name ?? input.email.split('@')[0], createdBy: input.createdBy })
      .returning()
    contactId = newContact.id
    existingContact = newContact
  }

  // Check if junction already exists
  const [existingLink] = await db
    .select()
    .from(contactClients)
    .where(and(eq(contactClients.contactId, contactId), eq(contactClients.clientId, input.clientId)))
    .limit(1)

  if (!existingLink) {
    await db.insert(contactClients).values({ contactId, clientId: input.clientId })
  }

  return existingContact
}
