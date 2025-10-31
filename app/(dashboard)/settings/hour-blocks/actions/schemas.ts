import { z } from 'zod'

const invoicePattern = /^[A-Za-z0-9-]+$/

export const hourBlockSchema = z.object({
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

export const deleteSchema = z.object({ id: z.string().uuid() })
export const restoreSchema = z.object({ id: z.string().uuid() })
export const destroySchema = z.object({ id: z.string().uuid() })
