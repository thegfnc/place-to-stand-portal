import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users, clients, clientContacts, emailMetadata } from '../lib/db/schema'
import { eq, isNull, ilike, and, sql } from 'drizzle-orm'

const queryClient = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
const db = drizzle(queryClient)

async function main() {
  // Get user
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, 'damonbodine@gmail.com'))
    .limit(1)

  if (!user) {
    console.log('User not found')
    process.exit(1)
  }
  console.log('User:', user.id, user.email, user.role)

  // Get existing clients
  const existingClients = await db
    .select({ id: clients.id, name: clients.name, slug: clients.slug })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(clients.name)

  console.log('\nExisting clients:')
  existingClients.forEach(c => console.log('  - ' + c.name + ' (' + (c.slug || c.id) + ')'))

  // Check if Kendall Booking exists
  const [kb] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(ilike(clients.name, '%kendall%'))
    .limit(1)

  if (kb) {
    console.log('\nKendall Booking already exists:', kb.id)
  } else {
    // Create Kendall Booking
    const [newClient] = await db
      .insert(clients)
      .values({
        name: 'Kendall Booking',
        slug: 'kendall-booking',
        billingType: 'prepaid',
        createdBy: user.id,
      })
      .returning({ id: clients.id, name: clients.name, slug: clients.slug })

    console.log('\nCreated client:', newClient.name, newClient.id)

    // Add contact
    const [contact] = await db
      .insert(clientContacts)
      .values({
        clientId: newClient.id,
        email: 'shawn@kendallbooking.com',
        name: 'Shawn Radley',
        isPrimary: true,
        createdBy: user.id,
      })
      .returning({ id: clientContacts.id, email: clientContacts.email, name: clientContacts.name })

    console.log('Added contact:', contact.name, contact.email)
  }

  // Check all contacts
  const allContacts = await db
    .select({
      email: clientContacts.email,
      name: clientContacts.name,
      clientName: clients.name,
    })
    .from(clientContacts)
    .innerJoin(clients, eq(clients.id, clientContacts.clientId))
    .where(and(isNull(clients.deletedAt), isNull(clientContacts.deletedAt)))

  console.log('\nAll client contacts:')
  allContacts.forEach(c => console.log('  - ' + c.clientName + ': ' + (c.name || '(unnamed)') + ' <' + c.email + '>'))

  // Count emails
  const [emailCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailMetadata)
    .where(and(eq(emailMetadata.userId, user.id), isNull(emailMetadata.deletedAt)))

  console.log('\nCurrent email count:', emailCount.count)

  await queryClient.end()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
