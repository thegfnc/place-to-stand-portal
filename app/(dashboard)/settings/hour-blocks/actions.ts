'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
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

  if (!id) {
    const { error } = await supabase.from('hour_blocks').insert({
      client_id: clientId,
      hours_purchased: hoursPurchased,
      invoice_number: normalizedInvoiceNumber,
      created_by: user.id,
    })

    if (error) {
      console.error('Failed to create hour block', error)
      return { error: error.message }
    }
  } else {
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
  }

  revalidatePath('/settings/hour-blocks')

  return {}
}

export async function softDeleteHourBlock(
  input: DeleteInput
): Promise<ActionResult> {
  await requireUser()
  const parsed = deleteSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
  }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('hour_blocks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)

  if (error) {
    console.error('Failed to archive hour block', error)
    return { error: error.message }
  }

  revalidatePath('/settings/hour-blocks')

  return {}
}
