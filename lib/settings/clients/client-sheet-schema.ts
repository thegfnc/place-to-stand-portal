import { z } from 'zod'

import {
  CLIENT_BILLING_TYPE_VALUES,
  type ClientBillingTypeValue,
} from './billing-types'

export const clientSheetFormSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only')
    .or(z.literal(''))
    .optional(),
  billingType: z.enum(CLIENT_BILLING_TYPE_VALUES),
  notes: z.string().optional(),
})

export type ClientSheetFormValues = z.infer<typeof clientSheetFormSchema>
export type ClientSheetBillingTypeValue = ClientBillingTypeValue
