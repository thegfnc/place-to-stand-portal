import { config } from 'dotenv'
config({ path: '.env.local' })

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, eq, isNull, sql, not } from 'drizzle-orm'
import { emailMetadata, emailLinks, clientContacts, users } from '../lib/db/schema'

const queryClient = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
const db = drizzle(queryClient)

const BATCH_SIZE = 100

function normalize(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase()
}

function domain(email: string) {
  const idx = email.indexOf('@')
  return idx >= 0 ? email.slice(idx + 1) : ''
}

async function main() {
  console.log('Batch matching emails to clients...\n')

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

  // Get all contacts
  const contacts = await db
    .select({
      id: clientContacts.id,
      clientId: clientContacts.clientId,
      email: clientContacts.email,
    })
    .from(clientContacts)
    .where(isNull(clientContacts.deletedAt))

  console.log('Contacts found:', contacts.length)
  contacts.forEach(c => console.log('  -', c.email))

  // Build lookup structures
  const contactEmailToClientIds = new Map<string, Set<string>>()
  const contactDomainToClientIds = new Map<string, Set<string>>()

  for (const c of contacts) {
    const email = normalize(c.email)
    const d = domain(email)

    if (!contactEmailToClientIds.has(email)) {
      contactEmailToClientIds.set(email, new Set())
    }
    contactEmailToClientIds.get(email)!.add(c.clientId)

    if (d) {
      if (!contactDomainToClientIds.has(d)) {
        contactDomainToClientIds.set(d, new Set())
      }
      contactDomainToClientIds.get(d)!.add(c.clientId)
    }
  }

  // Get all email IDs for user
  const allEmails = await db
    .select({
      id: emailMetadata.id,
      fromEmail: emailMetadata.fromEmail,
      toEmails: emailMetadata.toEmails,
      ccEmails: emailMetadata.ccEmails,
    })
    .from(emailMetadata)
    .where(and(eq(emailMetadata.userId, user.id), isNull(emailMetadata.deletedAt)))

  console.log('\nTotal emails:', allEmails.length)

  // Get existing links
  const existingLinks = await db
    .select({
      emailMetadataId: emailLinks.emailMetadataId,
      clientId: emailLinks.clientId,
    })
    .from(emailLinks)
    .where(and(isNull(emailLinks.deletedAt), not(isNull(emailLinks.clientId))))

  const existingLinkSet = new Set(
    existingLinks.map(l => `${l.emailMetadataId}:${l.clientId}`)
  )

  console.log('Existing links:', existingLinks.length)

  // Process each email and find matches
  let linksCreated = 0
  const linksToCreate: {
    emailMetadataId: string
    clientId: string
    confidence: string
  }[] = []

  for (const email of allEmails) {
    const from = normalize(email.fromEmail)
    const tos = (email.toEmails ?? []).map(normalize)
    const ccs = (email.ccEmails ?? []).map(normalize)
    const allAddresses = Array.from(new Set([from, ...tos, ...ccs].filter(Boolean)))
    const addressDomains = Array.from(new Set(allAddresses.map(domain).filter(Boolean)))

    // Find matching client IDs
    const matchedClients = new Map<string, 'exact' | 'domain'>()

    for (const addr of allAddresses) {
      const clients = contactEmailToClientIds.get(addr)
      if (clients) {
        for (const clientId of clients) {
          matchedClients.set(clientId, 'exact')
        }
      }
    }

    for (const d of addressDomains) {
      const clients = contactDomainToClientIds.get(d)
      if (clients) {
        for (const clientId of clients) {
          if (!matchedClients.has(clientId)) {
            matchedClients.set(clientId, 'domain')
          }
        }
      }
    }

    // Create links for new matches
    for (const [clientId, matchType] of matchedClients.entries()) {
      const key = `${email.id}:${clientId}`
      if (!existingLinkSet.has(key)) {
        linksToCreate.push({
          emailMetadataId: email.id,
          clientId,
          confidence: matchType === 'exact' ? '1.00' : '0.60',
        })
        existingLinkSet.add(key) // Prevent duplicates within this run
      }
    }
  }

  console.log('\nNew links to create:', linksToCreate.length)

  // Insert in batches
  for (let i = 0; i < linksToCreate.length; i += BATCH_SIZE) {
    const batch = linksToCreate.slice(i, i + BATCH_SIZE)
    await db.insert(emailLinks).values(
      batch.map(l => ({
        emailMetadataId: l.emailMetadataId,
        clientId: l.clientId,
        projectId: null,
        source: 'AUTOMATIC' as const,
        confidence: l.confidence,
        linkedBy: null,
        notes: null,
      }))
    )
    linksCreated += batch.length
    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, linksToCreate.length)}/${linksToCreate.length}`)
  }

  // Stats
  const [totalLinks] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLinks)
    .where(and(isNull(emailLinks.deletedAt), not(isNull(emailLinks.clientId))))

  console.log('\nDone! Links created:', linksCreated)
  console.log('Total links in DB:', totalLinks.count)

  // Show breakdown by client
  const breakdown = await db
    .select({
      count: sql<number>`count(*)`,
      clientId: emailLinks.clientId,
    })
    .from(emailLinks)
    .where(and(isNull(emailLinks.deletedAt), not(isNull(emailLinks.clientId))))
    .groupBy(emailLinks.clientId)

  console.log('\nLinks by client:')
  for (const row of breakdown) {
    const [client] = contacts.filter(c => c.clientId === row.clientId).slice(0, 1)
    console.log('  -', client?.email || row.clientId, ':', row.count)
  }

  await queryClient.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
