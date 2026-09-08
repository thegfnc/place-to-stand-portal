import { z } from 'zod'

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'since must be an ISO date (YYYY-MM-DD).')

/** A client UUID or slug — resolved server-side, since agents know slugs. */
const clientRefSchema = z.string().trim().min(1, 'client is required.')

export const clientUpdateStatusSchema = z.enum(['DRAFT', 'SENT'])

const itemSchema = z.object({
  taskId: z.string().uuid().nullish(),
  label: z.string().trim().min(1, 'Each item needs a label.').max(200),
  /** Minimal markdown: bold, italic, links, line breaks. */
  body: z.string().max(5000).default(''),
})

export const cliCreateUpdateSchema = z.object({
  client: clientRefSchema,
  since: dateSchema.nullish(),
  subject: z.string().trim().max(500).nullish(),
  intro: z.string().max(2000).nullish(),
  items: z.array(itemSchema).max(50).nullish(),
  closing: z.string().max(2000).nullish(),
})

export const cliUpdateListQuerySchema = z.object({
  client: clientRefSchema.optional(),
  status: clientUpdateStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type CliCreateUpdateInput = z.infer<typeof cliCreateUpdateSchema>
