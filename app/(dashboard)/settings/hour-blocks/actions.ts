'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import {
  hourBlockArchivedEvent,
  hourBlockCreatedEvent,
  hourBlockUpdatedEvent,
} from '@/lib/activity/events'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const invoicePattern = /^[A-Za-z0-9-]+$/

const hourBlockSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid('Select a client'),
  hoursPurchased: z
    .number()
    .int('Hours purchased must be a whole number.')
    .positive('Hours purchased must be greater than zero'),
  invoiceNumber: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine(
      value => !value || value === '' || invoicePattern.test(value),
      'Invoice number may only contain letters, numbers, and dashes.'
    ),
})

const deleteSchema = z.object({ id: z.string().uuid() })

type ActionResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

type HourBlockInput = z.infer<typeof hourBlockSchema>

type DeleteInput = z.infer<typeof deleteSchema>

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
  const normalizedInvoiceNumber =
    invoiceNumber && invoiceNumber.trim().length > 0
      ? invoiceNumber.trim()
      : null

  const { data: targetClient, error: clientLookupError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .is('deleted_at', null)
    .maybeSingle()

  if (clientLookupError) {
    console.error('Failed to load client for hour block', clientLookupError)
    return { error: 'Unable to load client information.' }
  }

  if (!targetClient) {
    return { error: 'Selected client could not be found.' }
  }

  const targetClientName = targetClient.name

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
    const { data: existingHourBlock, error: existingError } = await supabase
      .from('hour_blocks')
      .select(
        `
          id,
          client_id,
          hours_purchased,
          invoice_number,
          client:clients ( id, name )
        `
      )
      .eq('id', id)
      .maybeSingle()

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

  revalidatePath('/settings/hour-blocks')

  return {}
}

export async function softDeleteHourBlock(
  input: DeleteInput
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = deleteSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const hourBlockId = parsed.data.id

  const { data: existingHourBlock, error: loadError } = await supabase
    .from('hour_blocks')
    .select(
      `
        id,
        client_id,
        client:clients ( name )
      `
    )
    .eq('id', hourBlockId)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load hour block for archive', loadError)
    return { error: 'Unable to archive hour block.' }
  }

  if (!existingHourBlock) {
    return { error: 'Hour block not found.' }
  }

  const { error } = await supabase
    .from('hour_blocks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', hourBlockId)

  if (error) {
    console.error('Failed to archive hour block', error)
    return { error: error.message }
  }

  const event = hourBlockArchivedEvent({
    clientName: existingHourBlock.client?.name ?? null,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'HOUR_BLOCK',
    targetId: existingHourBlock.id,
    targetClientId: existingHourBlock.client_id,
    metadata: event.metadata,
  })

  revalidatePath('/settings/hour-blocks')

  return {}
}
