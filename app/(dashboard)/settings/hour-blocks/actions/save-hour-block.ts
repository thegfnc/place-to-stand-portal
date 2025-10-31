'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import {
  hourBlockCreatedEvent,
  hourBlockUpdatedEvent,
} from '@/lib/activity/events'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { hourBlockSchema } from './schemas'
import type { ActionResult, HourBlockInput } from './types'
import {
  HOUR_BLOCKS_SETTINGS_PATH,
  fetchActiveClient,
  fetchHourBlockWithClient,
  normalizeInvoiceNumber,
} from './helpers'

export async function saveHourBlock(
  input: HourBlockInput
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = hourBlockSchema.safeParse(input)

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const supabase = getSupabaseServerClient()
  const { id, clientId, hoursPurchased, invoiceNumber } = parsed.data
  const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber)

  const { client, error: clientLookupError } = await fetchActiveClient(
    supabase,
    clientId
  )

  if (clientLookupError) {
    console.error('Failed to load client for hour block', clientLookupError)
    return { error: 'Unable to load client information.' }
  }

  if (!client) {
    return { error: 'Selected client could not be found.' }
  }

  const targetClientName = client.name

  if (!id) {
    const { data, error } = await supabase
      .from('hour_blocks')
      .insert({
        client_id: clientId,
        hours_purchased: hoursPurchased,
        invoice_number: normalizedInvoiceNumber,
        created_by: user.id,
      })
      .select('id')
      .maybeSingle()

    if (error || !data) {
      console.error('Failed to create hour block', error)
      return { error: error?.message ?? 'Unable to create hour block.' }
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
      targetId: data.id,
      targetClientId: clientId,
      metadata: event.metadata,
    })
  } else {
    const { hourBlock: existingHourBlock, error: existingError } =
      await fetchHourBlockWithClient(supabase, id)

    if (existingError) {
      console.error('Failed to load hour block for update', existingError)
      return { error: 'Unable to update hour block.' }
    }

    if (!existingHourBlock) {
      return { error: 'Hour block not found.' }
    }

    const { error } = await supabase
      .from('hour_blocks')
      .update({
        client_id: clientId,
        hours_purchased: hoursPurchased,
        invoice_number: normalizedInvoiceNumber,
      })
      .eq('id', id)

    if (error) {
      console.error('Failed to update hour block', error)
      return { error: error.message }
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
