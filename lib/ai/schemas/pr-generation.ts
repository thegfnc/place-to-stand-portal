import { z } from 'zod'

export const generatedPRSchema = z.object({
  title: z
    .string()
    .max(100)
    .describe('PR title, optionally with conventional commit prefix (e.g., feat:, fix:, docs:)'),
  body: z
    .string()
    .max(10000)
    .describe('Markdown-formatted PR description with summary, context, and testing notes'),
  suggestedBranch: z
    .string()
    .max(100)
    .optional()
    .describe('Suggested feature branch name in kebab-case'),
  labels: z
    .array(z.string())
    .optional()
    .describe('Suggested PR labels like enhancement, bug, documentation'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score 0-1 indicating how actionable the email is for creating a PR'),
  reasoning: z
    .string()
    .max(500)
    .describe('Brief explanation of what the PR would accomplish and why this was extracted from the email'),
})

export type GeneratedPR = z.infer<typeof generatedPRSchema>
