import 'server-only'

import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clients,
  contactClients,
  contacts,
  leads,
  projects,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { LeadConversionSummary } from '@/lib/leads/types'

/**
 * What a converted lead became. The lead itself only records the client, so
 * the rest is resolved from it: the contact is the one carrying the lead's
 * email among that client's contacts (the record conversion creates or
 * reuses), and projects are the client's live projects — conversion doesn't
 * tag the project it creates, so linking to an existing client can surface
 * work that predates the lead.
 *
 * Returns null when the lead isn't converted. Archived leads still resolve,
 * since their sheet opens from the leads archive.
 */
export async function fetchLeadConversionSummary(
  user: AppUser,
  leadId: string
): Promise<LeadConversionSummary | null> {
  assertAdmin(user)

  const [lead] = await db
    .select({
      convertedToClientId: leads.convertedToClientId,
      contactEmail: leads.contactEmail,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    throw new NotFoundError('Lead not found')
  }

  const clientId = lead.convertedToClientId
  if (!clientId) return null

  const email = lead.contactEmail

  const [clientRows, contactRows, projectRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1),
    email
      ? db
          .select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
          })
          .from(contacts)
          .innerJoin(contactClients, eq(contactClients.contactId, contacts.id))
          .where(
            and(
              eq(contactClients.clientId, clientId),
              isNull(contacts.deletedAt),
              sql`lower(${contacts.email}) = lower(${email})`
            )
          )
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
      })
      .from(projects)
      .where(and(eq(projects.clientId, clientId), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name)),
  ])

  const client = clientRows[0]
  if (!client) return null

  return {
    client: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      archived: client.deletedAt !== null,
    },
    contact: contactRows[0] ?? null,
    projects: projectRows,
  }
}
