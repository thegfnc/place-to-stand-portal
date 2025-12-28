import 'server-only'

import { generateObject } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import {
  EMAIL_TO_CLIENT_SYSTEM_PROMPT,
  buildEmailToClientUserPrompt,
  type EmailToClientPromptParams,
} from './prompts/email-to-client'
import {
  emailClientMatchResponseSchema,
  type ClientMatch,
} from './schemas/email-client-match'

// Vercel AI Gateway - uses AI_GATEWAY_API_KEY env var automatically
const gateway = createGateway()
const model = gateway('google/gemini-2.5-flash-lite')

export interface MatchEmailToClientsParams {
  email: {
    from: string | null
    to: string[]
    cc: string[]
    subject: string | null
    snippet: string | null
    bodyPreview?: string | null
  }
  clients: Array<{
    id: string
    name: string
    contacts: Array<{ email: string; name: string | null }>
    projects: Array<{ name: string }>
  }>
}

export interface MatchingResponse {
  matches: ClientMatch[]
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Use AI to match an email to potential clients
 */
export async function matchEmailToClients(
  params: MatchEmailToClientsParams
): Promise<MatchingResponse> {
  // If no clients to match against, return empty
  if (params.clients.length === 0) {
    return {
      matches: [],
      usage: { promptTokens: 0, completionTokens: 0 },
    }
  }

  const promptParams: EmailToClientPromptParams = {
    email: params.email,
    clients: params.clients,
  }

  const userPrompt = buildEmailToClientUserPrompt(promptParams)

  const { object, usage } = await generateObject({
    model,
    system: EMAIL_TO_CLIENT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: emailClientMatchResponseSchema,
  })

  // Filter out low confidence matches and sort by confidence
  const filteredMatches = object.matches
    .filter(m => m.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)

  return {
    matches: filteredMatches,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}

/**
 * Filter matches by minimum confidence threshold
 */
export function filterMatchesByConfidence(
  matches: ClientMatch[],
  minConfidence: number = 0.5
): ClientMatch[] {
  return matches.filter(m => m.confidence >= minConfidence)
}
