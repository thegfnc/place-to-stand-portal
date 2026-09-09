import { streamText, stepCountIs, type ModelMessage } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import { after } from 'next/server'
import { z } from 'zod'

import { planRevisionCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepoLinkById } from '@/lib/data/github-repos'
import { getRepoTree, resolveRepoLinkAuth } from '@/lib/github/client'
import { buildPlanningSystemPrompt, createPlanningTools } from '@/lib/ai/planning'
import {
  getMessages,
  appendMessage,
  createRevision,
  updateThreadVersion,
  startThreadGeneration,
  updateThreadPartialContent,
  finishThreadGeneration,
  failThreadGeneration,
  getPlanningContextForThread,
} from '@/lib/queries/planning'
import {
  PLANNING_MODEL_TIERS,
  DEFAULT_PLANNING_TIER,
  resolveGatewayModel,
  tierSupportsThinking,
} from '@/lib/planning/models'

const gateway = createGateway()

const requestSchema = z.object({
  threadId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
  taskTitle: z.string().min(1),
  taskDescription: z.string().nullable(),
  feedback: z.string().optional(),
  model: z.enum(PLANNING_MODEL_TIERS).default(DEFAULT_PLANNING_TIER),
  currentVersion: z.number().int().min(0),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const {
    threadId,
    repoLinkId,
    taskTitle,
    taskDescription,
    feedback,
    model: modelTier,
    currentVersion,
  } = parsed.data

  // Resolve the generic tier to the latest gateway model id server-side.
  const gatewayModel = resolveGatewayModel(modelTier)

  // Load repo link for GitHub API access
  const repoLink = await getRepoLinkById(repoLinkId)
  if (!repoLink) {
    return new Response(JSON.stringify({ error: 'Repository not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Resolve auth once for all GitHub API calls
  const repoAuth = await resolveRepoLinkAuth(user.id, repoLink)

  // Fetch repo tree for system prompt context
  let repoTreePaths: string[] = []
  try {
    const tree = await getRepoTree(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      repoLink.defaultBranch,
      repoAuth
    )
    // Filter to key file types, limit depth
    repoTreePaths = tree.entries
      .filter(e => e.type === 'blob')
      .map(e => e.path)
      .filter(p => {
        // Exclude node_modules, .git, dist, etc.
        const excluded = ['node_modules/', '.git/', 'dist/', '.next/', '.vercel/', 'coverage/']
        return !excluded.some(ex => p.startsWith(ex))
      })
      .slice(0, 500) // Cap at 500 files for prompt size
  } catch {
    // Non-fatal — proceed without tree
  }

  const systemPrompt = buildPlanningSystemPrompt(
    taskTitle,
    taskDescription,
    repoTreePaths
  )

  // Build conversation history from stored messages
  const storedMessages = await getMessages(threadId)
  const conversationMessages: ModelMessage[] = storedMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  // Ensure conversation ends with a user message (required by Anthropic API)
  if (feedback) {
    conversationMessages.push({ role: 'user', content: feedback })
    await appendMessage(threadId, 'user', feedback)
  } else if (conversationMessages.length === 0) {
    const initialPrompt = 'Explore the repository to understand its structure, patterns, and relevant code, then generate the implementation plan.'
    conversationMessages.push({ role: 'user', content: initialPrompt })
    await appendMessage(threadId, 'user', initialPrompt)
  } else if (conversationMessages[conversationMessages.length - 1].role !== 'user') {
    // Safety: conversation must end with user message to avoid prefill error
    const continuePrompt = 'Continue generating the plan.'
    conversationMessages.push({ role: 'user', content: continuePrompt })
    await appendMessage(threadId, 'user', continuePrompt)
  }

  // Create planning tools for repo access
  const tools = createPlanningTools(
    user.id,
    repoLink.repoOwner,
    repoLink.repoName,
    repoAuth
  )

  const nextVersion = currentVersion + 1

  // Haiku doesn't support extended thinking
  const supportsThinking = tierSupportsThinking(modelTier)

  // Mark the thread as actively generating so a client that navigates away
  // and comes back (or a fresh mount) can detect and resume this in-flight
  // generation instead of showing the blank initial-planning screen.
  await startThreadGeneration(threadId, nextVersion)

  const PARTIAL_PERSIST_INTERVAL_MS = 1500
  let accumulatedText = ''
  let lastPersistedAt = 0
  let hasErrored = false

  const result = streamText({
    model: gateway(gatewayModel),
    system: systemPrompt,
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(25),
    providerOptions: supportsThinking
      ? {
          anthropic: {
            thinking: { type: 'enabled', budgetTokens: 16000 },
          } satisfies AnthropicLanguageModelOptions,
        }
      : undefined,
    onChunk: async ({ chunk }) => {
      if (chunk.type !== 'text-delta') return

      accumulatedText += chunk.text
      const now = Date.now()
      if (now - lastPersistedAt < PARTIAL_PERSIST_INTERVAL_MS) return

      lastPersistedAt = now
      try {
        await updateThreadPartialContent(threadId, accumulatedText)
      } catch (error) {
        console.error('[planning/generate] partial content persist failed', error)
      }
    },
    onError: async ({ error }) => {
      hasErrored = true
      try {
        await failThreadGeneration(
          threadId,
          error instanceof Error ? error.message : 'Generation failed'
        )
      } catch (persistError) {
        console.error('[planning/generate] failed to persist generation error', persistError)
      }
    },
    onFinish: async ({ text }) => {
      if (text) {
        // Persist assistant message
        await appendMessage(threadId, 'assistant', text)

        // Save as revision
        await createRevision(threadId, nextVersion, text, feedback || undefined)

        // Update thread version
        await updateThreadVersion(threadId, nextVersion)

        // One event per finished generation — the partial-content autosaves
        // above are not revisions.
        const context = await getPlanningContextForThread(threadId)
        const event = planRevisionCreatedEvent({
          taskTitle: context?.taskTitle ?? taskTitle,
          threadId,
          version: nextVersion,
          model: modelTier,
        })
        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          verb: event.verb,
          summary: event.summary,
          targetType: 'PLAN',
          targetId: context?.sessionId ?? null,
          targetProjectId: context?.projectId ?? null,
          targetClientId: context?.clientId ?? null,
          metadata: event.metadata,
        })
      }

      // onError may have already marked the thread as errored — don't clobber that.
      if (!hasErrored) {
        await finishThreadGeneration(threadId)
      }
    },
  })

  // Keep generating server-side even if the client disconnects (sheet closed,
  // navigation away, etc.) — streamText is backpressure-gated on consumption,
  // so without this, an early disconnect stalls generation and onFinish (the
  // only place the assistant message gets persisted) never runs. `after()`
  // keeps the function alive long enough for consumeStream() to finish.
  after(async () => {
    await result.consumeStream({
      onError: error => {
        console.error('[planning/generate] consumeStream error', error)
      },
    })
  })

  return result.toUIMessageStreamResponse()
}
