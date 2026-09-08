import { z } from 'zod'

import {
  CLIENT_BILLING_TYPE_VALUES
} from './billing-types'

export const clientSheetFormSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only')
    .or(z.literal(''))
    .optional(),
  billingType: z.enum(CLIENT_BILLING_TYPE_VALUES),
  // Month boundary the report basis switches at when billingType changes on
  // an existing client (the saved type applies to the UI/invoices at once).
  billingEffective: z.enum(['current_month', 'next_month']),
  state: z.string().max(2).optional(),
  website: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  notes: z.string().optional(),
})

export type ClientSheetFormValues = z.infer<typeof clientSheetFormSchema>
