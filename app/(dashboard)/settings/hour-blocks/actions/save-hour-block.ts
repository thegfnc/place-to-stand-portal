'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import {
  hourBlockCreatedEvent,
  hourBlockUpdatedEvent,
} from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { hourBlocks } from '@/lib/db/schema'
import {
  getActiveClientSummary,
  getHourBlockWithClientById,
} from '@/lib/queries/hour-blocks'

import { hourBlockSchema } from './schemas'
import type { ActionResult, HourBlockInput } from './types'
import {
  HOUR_BLOCKS_SETTINGS_PATH,
  normalizeInvoiceNumber,
} from './helpers'

export async function saveHourBlock(
  input: HourBlockInput,
): Promise<ActionResult> {
  const mode = input.id ? 'edit' : 'create'
  const targetId = input.id ?? null

  return trackSettingsServerInteraction(
    {
      entity: 'hour_block',
      mode,
      targetId,
      metadata: {
        clientId: input.clientId,
      },
    },
    async () => performSaveHourBlock(input),
  )
}

async function performSaveHourBlock(
  input: HourBlockInput,
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = hourBlockSchema.safeParse(input)

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const { id, clientId, hoursPurchased, invoiceNumber } = parsed.data
  const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber)
  const hoursPurchasedValue = hoursPurchased.toString()

  const client = await getActiveClientSummary(user, clientId)

  if (!client) {
    return { error: 'Selected client could not be found.' }
  }

  const targetClientName = client.name
  const nowIso = new Date().toISOString()

  if (!id) {
    try {
      const [inserted] = await db
        .insert(hourBlocks)
        .values({
          clientId,
          hoursPurchased: hoursPurchasedValue,
          invoiceNumber: normalizedInvoiceNumber,
          createdBy: user.id,
        })
        .returning({ id: hourBlocks.id })

      if (!inserted) {
        throw new Error('Unable to create hour block.')
      }

      const event = hourBlockCreatedEvent({
        clientName: targetClientName,
        hoursPurchased,
        invoiceNumber: normalizedInvoiceNumber,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'HOUR_BLOCK',
        targetId: inserted.id,
        targetClientId: clientId,
        metadata: event.metadata,
      })
    } catch (error) {
      console.error('Failed to create hour block', error)

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create hour block.',
      }
    }
  } else {
    const existingHourBlock = await getHourBlockWithClientById(user, id)

    if (!existingHourBlock) {
      return { error: 'Hour block not found.' }
    }

    try {
      await db
        .update(hourBlocks)
        .set({
          clientId,
          hoursPurchased: hoursPurchasedValue,
          invoiceNumber: normalizedInvoiceNumber,
          updatedAt: nowIso,
        })
        .where(eq(hourBlocks.id, id))
    } catch (error) {
      console.error('Failed to update hour block', error)

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update hour block.',
      }
    }

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingHourBlock.client_id !== clientId) {
      changedFields.push('client')
      previousDetails.clientId = existingHourBlock.client_id
      previousDetails.clientName = existingHourBlock.client?.name ?? null
      nextDetails.clientId = clientId
      nextDetails.clientName = targetClientName
    }

    if (existingHourBlock.hours_purchased !== hoursPurchased) {
      changedFields.push('hours')
      previousDetails.hoursPurchased = existingHourBlock.hours_purchased
      nextDetails.hoursPurchased = hoursPurchased
    }

    const previousInvoice = existingHourBlock.invoice_number ?? null
    if (previousInvoice !== normalizedInvoiceNumber) {
      changedFields.push('invoice number')
      previousDetails.invoiceNumber = previousInvoice
      nextDetails.invoiceNumber = normalizedInvoiceNumber
    }

    if (changedFields.length > 0) {
      const event = hourBlockUpdatedEvent({
        clientName: targetClientName,
        changedFields,
        details: {
          before: previousDetails,
          after: nextDetails,
        },
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'HOUR_BLOCK',
        targetId: id,
        targetClientId: clientId,
        metadata: event.metadata,
      })
    }
  }

  revalidatePath(HOUR_BLOCKS_SETTINGS_PATH)

  return {}
}
