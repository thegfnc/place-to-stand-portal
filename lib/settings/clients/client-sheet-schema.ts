import { z } from 'zod'

export const clientSheetFormSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only')
    .or(z.literal(''))
    .optional(),
  notes: z.string().optional(),
})

export type ClientSheetFormValues = z.infer<typeof clientSheetFormSchema>
