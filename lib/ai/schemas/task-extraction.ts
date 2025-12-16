import { z } from 'zod'

export const extractedTaskSchema = z.object({
  title: z.string().max(200).describe('Actionable task title starting with a verb'),
  description: z.string().max(2000).optional().describe('Additional context and details'),
  dueDate: z.string().optional().describe('Due date if mentioned (YYYY-MM-DD format)'),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().describe('Task priority based on urgency'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1 based on clarity of request'),
  reasoning: z.string().max(500).describe('Brief explanation of why this is a task'),
})

export const emailAnalysisResultSchema = z.object({
  tasks: z.array(extractedTaskSchema).describe('Array of extracted actionable tasks'),
  noActionRequired: z.boolean().describe('True if email is informational only'),
  summary: z.string().max(500).describe('Brief explanation of the analysis'),
})

export type ExtractedTask = z.infer<typeof extractedTaskSchema>
export type EmailAnalysisResult = z.infer<typeof emailAnalysisResultSchema>
