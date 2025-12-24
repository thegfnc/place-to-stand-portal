import { z } from 'zod'

/**
 * Schema for AI-generated client matches from email analysis
 */
export const clientMatchSchema = z.object({
  clientId: z.string().uuid().describe('The exact UUID of the matched client from the provided list'),
  clientName: z.string().describe('The name of the matched client'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score from 0.0 to 1.0'),
  reasoning: z
    .string()
    .max(200)
    .describe('Brief explanation of why this client was matched'),
  matchType: z
    .enum(['EXACT_EMAIL', 'DOMAIN', 'CONTENT', 'CONTEXTUAL'])
    .describe('The primary reason for the match'),
})

export const emailClientMatchResponseSchema = z.object({
  matches: z
    .array(clientMatchSchema)
    .max(5)
    .describe('List of matched clients, sorted by confidence (highest first)'),
  noMatchReason: z
    .string()
    .max(100)
    .optional()
    .describe('If no matches found, explain why'),
})

export type ClientMatch = z.infer<typeof clientMatchSchema>
export type EmailClientMatchResponse = z.infer<typeof emailClientMatchResponseSchema>
