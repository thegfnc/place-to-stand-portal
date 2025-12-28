import 'server-only'

import { generateObject } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import {
  EMAIL_ANALYSIS_SYSTEM_PROMPT,
  buildEmailAnalysisUserPrompt,
} from './prompts/email-to-tasks'
import {
  emailAnalysisResultSchema,
  type EmailAnalysisResult,
} from './schemas/task-extraction'

// Vercel AI Gateway - uses AI_GATEWAY_API_KEY env var automatically
const gateway = createGateway()
const model = gateway('google/gemini-2.5-flash-lite')

export interface AnalyzeEmailParams {
  subject: string
  body: string
  fromEmail: string
  fromName?: string
  receivedAt: string
  clientName?: string
  projectName?: string
  recentTasks?: string[]
}

export interface AnalysisResponse {
  result: EmailAnalysisResult
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Analyze an email and extract actionable tasks using AI
 */
export async function analyzeEmailForTasks(
  params: AnalyzeEmailParams
): Promise<AnalysisResponse> {
  const userPrompt = buildEmailAnalysisUserPrompt(params)

  const { object, usage } = await generateObject({
    model,
    system: EMAIL_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: emailAnalysisResultSchema,
  })

  return {
    result: object,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}

/**
 * Filter tasks by minimum confidence threshold
 */
export function filterByConfidence(
  tasks: EmailAnalysisResult['tasks'],
  minConfidence: number = 0.5
): EmailAnalysisResult['tasks'] {
  return tasks.filter(task => task.confidence >= minConfidence)
}
