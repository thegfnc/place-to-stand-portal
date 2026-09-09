'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { logActivity } from '@/lib/activity/logger'
import { contactCreatedEvent, leadConvertedEvent } from '@/lib/activity/events'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, contacts, contactClients, leads } from '@/lib/db/schema'
import { createClient } from '@/lib/settings/clients/actions/create-client'
import { saveProject } from '@/lib/settings/projects/actions/save-project'
import { extractLeadNotes } from '@/lib/leads/notes'
import { leadConversionSchema, type LeadConversionFormValues } from '../conversion-schema'
import type { LeadConversionResult } from '../conversion-types'

export async function convertLeadToClient(
  input: LeadConversionFormValues
): Promise<LeadConversionResult> {
  const user = await requireRole('ADMIN')
  const parsed = leadConversionSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid conversion data.' }
  }

  const {
    leadId,
    clientName,
    clientSlug,
    billingType,
    copyNotesToClient,
    createContact,
    createProject,
    projectName,
    existingClientId,
    memberIds,
  } = parsed.data

  // 1. Fetch the lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { error: 'Lead not found.' }
  }

  if (lead.convertedToClientId) {
    return { error: 'Lead already converted.' }
  }

  if (lead.status !== 'CLOSED_WON') {
    return { error: 'Only CLOSED_WON leads can be converted.' }
  }

  let finalClientId: string
  let finalClientSlug: string | undefined

  if (existingClientId) {
    // 2a. Link to existing client
    const [existingClient] = await db
      .select({ id: clients.id, slug: clients.slug })
      .from(clients)
      .where(and(eq(clients.id, existingClientId), isNull(clients.deletedAt)))
      .limit(1)

    if (!existingClient) {
      return { error: 'Selected client not found.' }
    }

    finalClientId = existingClient.id
    finalClientSlug = existingClient.slug ?? undefined
  } else {
    // 2b. Create a new client (reuse existing action)
    const resolvedName = clientName || lead.companyName || lead.contactName
    const resolvedNotes = copyNotesToClient
      ? extractLeadNotes(lead.notes as Record<string, unknown>)
      : null

    const clientResult = await createClient(
      { user },
      {
        name: resolvedName,
        providedSlug: clientSlug || null,
        billingType,
        state: null,
        website: lead.companyWebsite || null,
        originationContactId: null,
        originationUserId: null,
        closerUserId: null,
        notes: resolvedNotes,
        memberIds: memberIds || [],
      }
    )

    if (clientResult.error || !clientResult.clientId) {
      return { error: clientResult.error || 'Failed to create client.' }
    }

    const [createdClient] = await db
      .select({ slug: clients.slug })
      .from(clients)
      .where(eq(clients.id, clientResult.clientId))
      .limit(1)

    finalClientId = clientResult.clientId
    finalClientSlug = createdClient?.slug ?? undefined
  }

  // 3. Create a contact from lead info (if requested and lead has an email)
  const warnings: string[] = []
  const contactEmail = lead.contactEmail
  if (createContact && contactEmail) {
    try {
      // Check if contact already exists with this email
      const [existingContact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.email, contactEmail), isNull(contacts.deletedAt)))
        .limit(1)

      let contactId = existingContact?.id

      if (!contactId) {
        const [newContact] = await db
          .insert(contacts)
          .values({
            email: contactEmail,
            name: lead.contactName,
            phone: lead.contactPhone,
            createdBy: user.id,
          })
          .returning({ id: contacts.id })

        if (!newContact) {
          throw new Error('Contact insert returned no rows')
        }
        contactId = newContact.id

        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          targetType: 'CONTACT',
          targetId: contactId,
          targetClientId: finalClientId,
          ...contactCreatedEvent({
            email: contactEmail,
            name: lead.contactName,
          }),
        })
      }

      // Link contact to client (ignore if already linked)
      const [existingLink] = await db
        .select({ id: contactClients.id })
        .from(contactClients)
        .where(
          and(
            eq(contactClients.contactId, contactId),
            eq(contactClients.clientId, finalClientId)
          )
        )
        .limit(1)

      if (!existingLink) {
        await db.insert(contactClients).values({
          contactId,
          clientId: finalClientId,
          isPrimary: true,
        })
      }
    } catch (err) {
      console.error('[convert-lead] Failed to create contact:', err)
      warnings.push('Contact record could not be created. You can add it manually from the client page.')
    }
  }

  // 4. Create a project linked to the client (if requested)
  let projectId: string | undefined
  if (createProject && projectName) {
    try {
      const projectResult = await saveProject({
        name: projectName,
        projectType: 'CLIENT',
        clientId: finalClientId,
        status: 'ACTIVE',
        startsOn: null,
        endsOn: null,
        slug: null,
        ownerId: null,
      })

      if (projectResult.error) {
        console.error('[convert-lead] Failed to create project:', projectResult.error)
        warnings.push(`Project could not be created: ${projectResult.error}`)
      } else {
        projectId = projectResult.projectId
      }
    } catch (err) {
      console.error('[convert-lead] Failed to create project:', err)
      warnings.push('Project could not be created. You can create it manually from settings.')
    }
  }

  // 5. Update the lead with conversion info
  await db
    .update(leads)
    .set({
      convertedAt: new Date().toISOString(),
      convertedToClientId: finalClientId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(leads.id, leadId))

  // 6. Log activity
  const resolvedName = clientName || lead.companyName || lead.contactName
  const event = leadConvertedEvent({
    leadId,
    leadName: lead.contactName,
    clientId: finalClientId,
    clientName: resolvedName,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'LEAD',
    targetId: leadId,
    targetClientId: finalClientId,
    metadata: event.metadata,
  })

  revalidatePath('/leads')
  revalidatePath('/clients')

  return {
    clientId: finalClientId,
    clientSlug: finalClientSlug,
    projectId,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
