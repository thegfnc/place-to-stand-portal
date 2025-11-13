import { z } from 'zod'

const invoicePattern = /^[A-Za-z0-9-]+$/

export const DEFAULT_HOURS_PURCHASED = 5

export const hourBlockFormSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  hoursPurchased: z.coerce
    .number()
    .int('Hours purchased must be a whole number.')
    .positive('Hours purchased must be greater than zero'),
  invoiceNumber: z
    .string()
    .trim()
    .optional()
    .refine(
      value => !value || value === '' || invoicePattern.test(value),
      'Invoice number may only contain letters, numbers, and dashes.'
    ),
})

export type HourBlockFormValues = z.infer<typeof hourBlockFormSchema>

type HourBlockRow = {
  id: string
  client_id: string
  hours_purchased: number
  invoice_number: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type ClientRow = {
  id: string
  name: string
  deleted_at: string | null
}

export type HourBlockWithClient = HourBlockRow & { client: ClientRow | null }

export const HOUR_BLOCK_FORM_FIELDS: Array<keyof HourBlockFormValues> = [
  'clientId',
  'hoursPurchased',
  'invoiceNumber',
]

export const buildHourBlockFormDefaults = (
  hourBlock: HourBlockWithClient | null
): HourBlockFormValues => ({
  clientId: hourBlock?.client_id ?? '',
  hoursPurchased: hourBlock?.hours_purchased ?? DEFAULT_HOURS_PURCHASED,
  invoiceNumber: hourBlock?.invoice_number ?? '',
})

export type HourBlockSavePayload = {
  id?: string
  clientId: string
  hoursPurchased: number
  invoiceNumber: string | null
}

export const createHourBlockSavePayload = (
  values: HourBlockFormValues,
  hourBlock: HourBlockWithClient | null
): HourBlockSavePayload => ({
  id: hourBlock?.id,
  clientId: values.clientId,
  hoursPurchased: values.hoursPurchased,
  invoiceNumber:
    values.invoiceNumber && values.invoiceNumber.trim().length > 0
      ? values.invoiceNumber.trim()
      : null,
})

export const sortClientsByName = (clients: ClientRow[]): ClientRow[] =>
  [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

export type { ClientRow }
