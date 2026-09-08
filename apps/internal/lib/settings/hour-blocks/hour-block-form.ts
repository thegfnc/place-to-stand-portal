import { z } from 'zod'

const DEFAULT_HOURS_PURCHASED = 5

export const HOUR_BLOCK_NOTES_MAX_LENGTH = 2000

export const hourBlockFormSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  hoursPurchased: z.coerce
    .number()
    .int('Hours purchased must be a whole number.')
    .positive('Hours purchased must be greater than zero'),
  invoiceId: z
    .string()
    .refine(
      value => value === '' || z.string().uuid().safeParse(value).success,
      'Select a valid invoice.'
    ),
  notes: z
    .string()
    .trim()
    .max(
      HOUR_BLOCK_NOTES_MAX_LENGTH,
      `Notes must be ${HOUR_BLOCK_NOTES_MAX_LENGTH} characters or fewer.`
    ),
})

export type HourBlockFormValues = z.infer<typeof hourBlockFormSchema>

type HourBlockRow = {
  id: string
  client_id: string
  hours_purchased: number
  invoice_id: string | null
  /** Derived from the linked invoice at query time — not a stored column. */
  invoice_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /** Month the block's hours are billed in ('yyyy-MM-dd', PRD 002 D13). */
  billing_month: string
}

type ClientRow = {
  id: string
  name: string
  deleted_at: string | null
}

/** Invoice directory row the sheet's invoice picker renders. */
export type HourBlockInvoiceRow = {
  id: string
  invoice_number: string
  client_id: string
  client_name: string | null
  status: string
  total: number
  issued_date: string | null
}

export type HourBlockWithClient = HourBlockRow & { client: ClientRow | null }

export const HOUR_BLOCK_FORM_FIELDS: Array<keyof HourBlockFormValues> = [
  'clientId',
  'hoursPurchased',
  'invoiceId',
  'notes',
]

export const buildHourBlockFormDefaults = (
  hourBlock: HourBlockWithClient | null
): HourBlockFormValues => ({
  clientId: hourBlock?.client_id ?? '',
  hoursPurchased: hourBlock?.hours_purchased ?? DEFAULT_HOURS_PURCHASED,
  invoiceId: hourBlock?.invoice_id ?? '',
  notes: hourBlock?.notes ?? '',
})

export type HourBlockSavePayload = {
  id?: string
  clientId: string
  hoursPurchased: number
  invoiceId: string | null
  notes: string | null
}

export const createHourBlockSavePayload = (
  values: HourBlockFormValues,
  hourBlock: HourBlockWithClient | null
): HourBlockSavePayload => ({
  id: hourBlock?.id,
  clientId: values.clientId,
  hoursPurchased: values.hoursPurchased,
  invoiceId: values.invoiceId.length > 0 ? values.invoiceId : null,
  notes: values.notes.trim().length > 0 ? values.notes.trim() : null,
})

export const sortClientsByName = (clients: ClientRow[]): ClientRow[] =>
  [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

export type { ClientRow }
