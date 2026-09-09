import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactCreatedEvent, contactUpdatedEvent } from '@/lib/activity/events/contacts'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import {
  contactSchema,
  type ContactInput,
} from '@/lib/settings/contacts/contact-service'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export async function saveContactMutation(
  context: ContactMutationContext,
  input: ContactInput
): Promise<ContactMutationResult> {
  const parsed = contactSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({
      error: parsed.error.issues[0]?.message ?? 'Invalid contact data.',
    })
  }

  const isUpdate = Boolean(parsed.data.id)

  return trackSettingsServerInteraction(
    {
      entity: 'contact',
      mode: isUpdate ? 'edit' : 'create',
      targetId: parsed.data.id,
    },
    async () => {
      const { user } = context
      try {
        assertAdmin(user)
      } catch (error) {
        if (error instanceof Error) {
          return buildMutationResult({ error: error.message })
        }
        return buildMutationResult({ error: 'Admin privileges required.' })
      }

      const { id, email, name, phone } = parsed.data

      if (isUpdate && id) {
        // Update existing contact
        let existingContact:
          | { id: string; email: string; name: string; phone: string | null }
          | undefined

        try {
          const rows = await db
            .select({
              id: contacts.id,
              email: contacts.email,
              name: contacts.name,
              phone: contacts.phone,
            })
            .from(contacts)
            .where(eq(contacts.id, id))
            .limit(1)

          existingContact = rows[0]
        } catch (error) {
          console.error('Failed to load contact for update', error)
          return buildMutationResult({ error: 'Unable to update contact.' })
        }

        if (!existingContact) {
          return buildMutationResult({ error: 'Contact not found.' })
        }

        const changedFields: string[] = []
        const before: Record<string, unknown> = {}
        const after: Record<string, unknown> = {}
        const nextPhone = phone ?? null

        if (existingContact.email !== email) {
          changedFields.push('email')
          before.email = existingContact.email
          after.email = email
        }
        if (existingContact.name !== name) {
          changedFields.push('name')
          before.name = existingContact.name
          after.name = name
        }
        if (existingContact.phone !== nextPhone) {
          changedFields.push('phone')
          before.phone = existingContact.phone
          after.phone = nextPhone
        }

        try {
          await db
            .update(contacts)
            .set({
              email,
              name,
              phone,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(contacts.id, id))
        } catch (error) {
          console.error('Failed to update contact', error)
          return buildMutationResult({
            error:
              error instanceof Error ? error.message : 'Unable to update contact.',
          })
        }

        if (changedFields.length > 0) {
          const event = contactUpdatedEvent({
            email,
            name,
            changedFields,
            details: { before, after },
          })

          await logActivity({
            actorId: user.id,
            actorRole: user.role,
            verb: event.verb,
            summary: event.summary,
            targetType: 'CONTACT',
            targetId: id,
            metadata: event.metadata,
          })
        }

        return buildMutationResult({})
      }

      // Create new contact
      let newContactId: string

      try {
        const result = await db
          .insert(contacts)
          .values({
            email,
            name,
            phone,
            createdBy: user.id,
          })
          .returning({ id: contacts.id })

        newContactId = result[0]?.id ?? ''
      } catch (error) {
        console.error('Failed to create contact', error)
        // Check for unique constraint violation on email
        if (
          error instanceof Error &&
          error.message.includes('contacts_email_key')
        ) {
          return buildMutationResult({
            error: 'A contact with this email already exists.',
          })
        }
        return buildMutationResult({
          error:
            error instanceof Error ? error.message : 'Unable to create contact.',
        })
      }

      const event = contactCreatedEvent({ email, name })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CONTACT',
        targetId: newContactId,
        metadata: event.metadata,
      })

      return buildMutationResult({ id: newContactId })
    }
  )
}
