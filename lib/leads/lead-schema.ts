import { z } from 'zod'

/**
 * Schema for lead form values.
 */
export const leadFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Lead name is required').max(255),
  status: z.enum([
    'NEW_OPPORTUNITIES',
    'ACTIVE_OPPORTUNITIES',
    'PROPOSAL_SENT',
    'ON_ICE',
    'CLOSED_WON',
    'CLOSED_LOST',
  ]),
  source: z.string().max(255).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  contactEmail: z
    .union([z.string().email(), z.literal('')])
    .transform(val => (val === '' ? null : val))
    .optional()
    .nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  notes: z.record(z.string(), z.unknown()).optional().nullable(),
})

export type LeadFormValues = z.infer<typeof leadFormSchema>

/**
 * Schema for updating a lead's status (e.g., via drag and drop).
 */
export const leadStatusUpdateSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum([
    'NEW_OPPORTUNITIES',
    'ACTIVE_OPPORTUNITIES',
    'PROPOSAL_SENT',
    'ON_ICE',
    'CLOSED_WON',
    'CLOSED_LOST',
  ]),
})

export type LeadStatusUpdate = z.infer<typeof leadStatusUpdateSchema>

